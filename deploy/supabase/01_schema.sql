-- =====================================================================
-- Ronart Apartments: complete database setup for a NEW Supabase project
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Final state of all migrations applied on the original project.
-- =====================================================================

-- ---------- extensions ----------
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------- private helpers (not exposed through the API) ----------
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------- types ----------
create type public.unit_type as enum ('apartment','suite');
create type public.booking_channel as enum ('website','booking','airbnb','phone','walkin','other');
create type public.booking_status as enum ('hold','pending','confirmed','checked_in','checked_out','cancelled','no_show');
create type public.payment_option as enum ('full','deposit','on_arrival','channel');
create type public.payment_method as enum ('card_online','cash','card_pos','bank_transfer','channel');
create type public.payment_status as enum ('initiated','succeeded','failed','refunded');
create type public.staff_role as enum ('owner','reception');

-- ---------- tables ----------
create table public.staff (
  user_id uuid primary key references auth.users(id),
  full_name text not null,
  role public.staff_role not null default 'reception',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type public.unit_type not null,
  description_sq text,
  description_en text,
  max_guests int not null default 2 check (max_guests between 1 and 20),
  beds text,
  size_m2 int,
  has_balcony boolean not null default false,
  base_price numeric(10,2) not null check (base_price >= 0),
  photos text[] not null default '{}',
  beds24_room_id bigint unique,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  country text,
  notes text,
  is_blacklisted boolean not null default false,
  blacklist_reason text,
  no_show_count int not null default 0,
  anonymized_at timestamptz,
  created_at timestamptz not null default now()
);
create index guests_email_idx on public.guests (lower(email));
create index guests_phone_idx on public.guests (phone);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('RON-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  unit_id uuid not null references public.units(id),
  guest_id uuid references public.guests(id),
  check_in date not null,
  check_out date not null,
  stay daterange generated always as (daterange(check_in, check_out, '[)')) stored,
  adults int not null default 1 check (adults >= 1),
  children int not null default 0 check (children >= 0),
  channel public.booking_channel not null,
  status public.booking_status not null,
  payment_option public.payment_option not null,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  deposit_amount numeric(10,2) not null default 0 check (deposit_amount >= 0),
  paid_amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  hold_expires_at timestamptz,
  confirm_deadline timestamptz,
  beds24_booking_id bigint unique,
  beds24_sync_needed boolean not null default false,
  allow_overlap boolean not null default false,
  needs_refund boolean not null default false,
  guest_note text,
  internal_note text,
  cancelled_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (check_out - check_in <= 60),
  -- one unit can never have two active bookings on the same night
  constraint no_double_booking exclude using gist (
    unit_id with =, stay with &&
  ) where (status in ('hold','pending','confirmed','checked_in') and not allow_overlap)
);
create index bookings_dates_idx on public.bookings (check_in, check_out);
create index bookings_status_idx on public.bookings (status);
create index bookings_guest_idx on public.bookings (guest_id);
create index bookings_unit_idx on public.bookings (unit_id);
create index bookings_hold_idx on public.bookings (hold_expires_at) where status = 'hold';
create index bookings_created_by_idx on public.bookings (created_by);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'EUR',
  method public.payment_method not null,
  status public.payment_status not null,
  provider text,
  provider_ref text,
  received_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create index payments_received_by_idx on public.payments (received_by);
create unique index payments_provider_ref_idx on public.payments (provider, provider_ref) where provider_ref is not null;

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_log (entity, entity_id);

create table public.rate_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_events_idx on public.rate_events (bucket, key_hash, created_at);

-- server-only: channel manager tokens
create table public.integration_tokens (
  provider text primary key,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.guest_documents (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests(id),
  booking_id uuid references public.bookings(id),
  storage_path text not null unique,
  kind text not null default 'id_card' check (kind in ('id_card','passport','driving_licence','other')),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index guest_documents_guest_idx on public.guest_documents (guest_id);
create index guest_documents_booking_idx on public.guest_documents (booking_id);
create index guest_documents_uploaded_by_idx on public.guest_documents (uploaded_by);

-- ---------- role helpers: active staff AND 2FA-verified session (aal2) ----------
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active
  ) and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.active and s.role = 'owner'
  ) and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- ---------- triggers ----------
create or replace function public.recalc_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings
     set paid_amount = coalesce((select sum(amount) from public.payments
                                  where booking_id = b and status = 'succeeded'),0)
                     - coalesce((select sum(amount) from public.payments
                                  where booking_id = b and status = 'refunded'),0)
   where id = b;
  return null;
end $$;
create trigger payments_recalc after insert or update on public.payments
for each row execute function public.recalc_paid();

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid text;
begin
  rid := to_jsonb(new) ->> (case when tg_table_name = 'staff' then 'user_id' else 'id' end);
  insert into public.audit_log (actor, action, entity, entity_id, data)
  values (
    (select auth.uid()), lower(tg_op), tg_table_name, rid,
    case tg_op
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else to_jsonb(new) end
  );
  return null;
end $$;
create trigger audit_bookings after insert or update on public.bookings for each row execute function public.audit_trigger();
create trigger audit_payments after insert or update on public.payments for each row execute function public.audit_trigger();
create trigger audit_guests after insert or update on public.guests for each row execute function public.audit_trigger();
create trigger audit_units after insert or update on public.units for each row execute function public.audit_trigger();
create trigger audit_staff after insert or update on public.staff for each row execute function public.audit_trigger();
create trigger audit_guest_documents after insert or update on public.guest_documents for each row execute function public.audit_trigger();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- ---------- booking logic (server only) ----------
create or replace function public.expire_stale_bookings() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.bookings
     set status = 'cancelled',
         cancelled_reason = case when status = 'hold' then 'hold_expired' else 'not_confirmed_in_time' end,
         beds24_sync_needed = (beds24_booking_id is not null)
   where (status = 'hold' and hold_expires_at < now())
      or (status = 'pending' and confirm_deadline < now());
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.active_bookings_for_contact(p_email text, p_phone text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.bookings b
  join public.guests g on g.id = b.guest_id
  where b.status in ('hold','pending','confirmed')
    and b.check_out >= current_date
    and ((p_email is not null and lower(g.email) = lower(p_email))
      or (p_phone is not null and g.phone = p_phone));
$$;

create or replace function public.create_web_booking(
  p_unit_id uuid, p_check_in date, p_check_out date, p_adults int, p_children int,
  p_full_name text, p_email text, p_phone text, p_country text, p_note text,
  p_option public.payment_option, p_total numeric, p_deposit numeric, p_charge numeric,
  p_hold_minutes int, p_max_active int, p_provider text
) returns table (booking_id uuid, booking_ref text, payment_id uuid, error text)
language plpgsql security definer set search_path = '' as $$
declare
  g_id uuid;
  u public.units%rowtype;
  b_id uuid; b_ref text; p_id uuid;
begin
  select * into u from public.units where id = p_unit_id and active;
  if u.id is null then return query select null::uuid, null::text, null::uuid, 'unit_not_found'; return; end if;
  if p_adults + p_children > u.max_guests then return query select null::uuid, null::text, null::uuid, 'too_many_guests'; return; end if;
  if p_check_in < current_date then return query select null::uuid, null::text, null::uuid, 'past_date'; return; end if;

  if exists (select 1 from public.guests
              where (lower(email) = lower(p_email) or phone = p_phone) and is_blacklisted) then
    return query select null::uuid, null::text, null::uuid, 'blocked'; return;
  end if;
  if public.active_bookings_for_contact(p_email, p_phone) >= p_max_active then
    return query select null::uuid, null::text, null::uuid, 'too_many_active'; return;
  end if;

  select id into g_id from public.guests where lower(email) = lower(p_email) order by created_at limit 1;
  if g_id is null then
    insert into public.guests (full_name, email, phone, country)
    values (p_full_name, lower(p_email), p_phone, p_country) returning id into g_id;
  else
    update public.guests set phone = coalesce(p_phone, phone), full_name = p_full_name,
      country = coalesce(p_country, country) where id = g_id;
  end if;

  begin
    insert into public.bookings (unit_id, guest_id, check_in, check_out, adults, children, channel, status,
      payment_option, total_amount, deposit_amount, hold_expires_at, guest_note)
    values (p_unit_id, g_id, p_check_in, p_check_out, p_adults, p_children, 'website', 'hold',
      p_option, p_total, p_deposit, now() + make_interval(mins => p_hold_minutes), p_note)
    returning id, ref into b_id, b_ref;
  exception when exclusion_violation then
    return query select null::uuid, null::text, null::uuid, 'unavailable'; return;
  end;

  insert into public.payments (booking_id, amount, method, status, provider)
  values (b_id, p_charge, 'card_online', 'initiated', p_provider)
  returning id into p_id;

  return query select b_id, b_ref, p_id, null::text;
end $$;

create or replace function public.confirm_online_payment(p_payment_id uuid, p_provider_ref text, p_amount numeric, p_success boolean)
returns table (booking_id uuid, outcome text)
language plpgsql security definer set search_path = '' as $$
declare pay public.payments%rowtype; bk public.bookings%rowtype;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then return query select null::uuid, 'payment_not_found'; return; end if;
  if pay.status <> 'initiated' then return query select pay.booking_id, 'already_processed'; return; end if;

  if not p_success then
    update public.payments set status = 'failed', provider_ref = p_provider_ref where id = pay.id;
    update public.bookings set status = 'cancelled', cancelled_reason = 'payment_failed',
      beds24_sync_needed = (beds24_booking_id is not null)
     where id = pay.booking_id and status = 'hold';
    return query select pay.booking_id, 'failed'; return;
  end if;

  if p_amount is distinct from pay.amount then
    update public.payments set status = 'failed', provider_ref = p_provider_ref, note = 'amount_mismatch: got ' || p_amount where id = pay.id;
    update public.bookings set internal_note = coalesce(internal_note || E'\n','') || 'Payment amount mismatch — check with bank.' where id = pay.booking_id;
    return query select pay.booking_id, 'amount_mismatch'; return;
  end if;

  update public.payments set status = 'succeeded', provider_ref = p_provider_ref where id = pay.id;
  select * into bk from public.bookings where id = pay.booking_id for update;

  if bk.status = 'hold' then
    update public.bookings set status = 'confirmed', hold_expires_at = null, beds24_sync_needed = true where id = bk.id;
    return query select bk.id, 'confirmed'; return;
  end if;

  begin
    update public.bookings set status = 'confirmed', cancelled_reason = null, hold_expires_at = null, beds24_sync_needed = true
     where id = bk.id and status = 'cancelled';
    if found then return query select bk.id, 'confirmed_late'; return; end if;
  exception when exclusion_violation then
    update public.bookings set needs_refund = true,
      internal_note = coalesce(internal_note || E'\n','') || 'Paid after hold expired and the room was taken. Refund needed.'
     where id = bk.id;
    return query select bk.id, 'needs_refund'; return;
  end;
  return query select bk.id, 'confirmed';
end $$;

-- ---------- data retention (Kosovo Law 06/L-082, storage limitation) ----------
create or replace function public.guests_due_for_anonymization(p_years int)
returns table (guest_id uuid)
language sql stable security definer set search_path = '' as $$
  select g.id from public.guests g
  where g.anonymized_at is null
    and not exists (
      select 1 from public.bookings b where b.guest_id = g.id
        and (b.check_out >= current_date - make_interval(years => p_years)::interval
             or b.status in ('hold','pending','confirmed','checked_in'))
    )
    and g.created_at < now() - make_interval(years => p_years);
$$;

create or replace function public.documents_due_for_deletion(p_days int)
returns table (doc_id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.storage_path from public.guest_documents d
  where d.created_at < now() - make_interval(days => p_days)
    and not exists (
      select 1 from public.bookings b where b.guest_id = d.guest_id
        and (b.check_out > current_date - p_days or b.status in ('hold','pending','confirmed','checked_in'))
    );
$$;

-- ---------- row level security ----------
alter table public.staff enable row level security;
alter table public.units enable row level security;
alter table public.guests enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_events enable row level security;          -- no policies: server only
alter table public.integration_tokens enable row level security;   -- no policies: server only
alter table public.guest_documents enable row level security;

create policy staff_select on public.staff for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy staff_owner_insert on public.staff for insert to authenticated with check ((select private.is_owner()));
create policy staff_owner_update on public.staff for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy units_public_read on public.units for select to anon using (active);
create policy units_auth_read on public.units for select to authenticated using (active or (select private.is_staff()));
create policy units_owner_insert on public.units for insert to authenticated with check ((select private.is_owner()));
create policy units_owner_update on public.units for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy guests_staff_read on public.guests for select to authenticated using ((select private.is_staff()));
create policy guests_staff_insert on public.guests for insert to authenticated with check ((select private.is_staff()));
create policy guests_staff_update on public.guests for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

create policy bookings_staff_read on public.bookings for select to authenticated using ((select private.is_staff()));
create policy bookings_staff_insert on public.bookings for insert to authenticated with check ((select private.is_staff()));
create policy bookings_staff_update on public.bookings for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

create policy payments_staff_read on public.payments for select to authenticated using ((select private.is_staff()));
create policy payments_staff_insert on public.payments for insert to authenticated
  with check ((select private.is_staff()) and method in ('cash','card_pos','bank_transfer') and status = 'succeeded' and received_by = (select auth.uid()));
create policy payments_owner_update on public.payments for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy settings_staff_read on public.settings for select to authenticated using ((select private.is_staff()));
create policy settings_owner_write on public.settings for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));

create policy audit_owner_read on public.audit_log for select to authenticated using ((select private.is_owner()));

create policy guest_docs_staff_read on public.guest_documents for select to authenticated using ((select private.is_staff()));
create policy guest_docs_staff_insert on public.guest_documents for insert to authenticated
  with check ((select private.is_staff()) and uploaded_by = (select auth.uid()));
create policy guest_docs_staff_remove on public.guest_documents for delete to authenticated using ((select private.is_staff()));

-- ---------- private storage for ID documents ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-ids', 'guest-ids', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy guest_ids_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'guest-ids' and (select private.is_staff()));
create policy guest_ids_staff_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'guest-ids' and (select private.is_staff()));
create policy guest_ids_staff_remove on storage.objects for delete to authenticated
  using (bucket_id = 'guest-ids' and (select private.is_staff()));

-- ---------- function permissions ----------
revoke execute on function private.is_staff() from public, anon;
revoke execute on function private.is_owner() from public, anon;
revoke execute on function public.recalc_paid() from public, anon, authenticated;
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.expire_stale_bookings() from public, anon, authenticated;
revoke execute on function public.active_bookings_for_contact(text, text) from public, anon, authenticated;
revoke execute on function public.create_web_booking(uuid,date,date,int,int,text,text,text,text,text,public.payment_option,numeric,numeric,numeric,int,int,text) from public, anon, authenticated;
revoke execute on function public.confirm_online_payment(uuid,text,numeric,boolean) from public, anon, authenticated;
revoke execute on function public.guests_due_for_anonymization(int) from public, anon, authenticated;
revoke execute on function public.documents_due_for_deletion(int) from public, anon, authenticated;
grant execute on function public.expire_stale_bookings() to service_role;
grant execute on function public.active_bookings_for_contact(text, text) to service_role;
grant execute on function public.create_web_booking(uuid,date,date,int,int,text,text,text,text,text,public.payment_option,numeric,numeric,numeric,int,int,text) to service_role;
grant execute on function public.confirm_online_payment(uuid,text,numeric,boolean) to service_role;
grant execute on function public.guests_due_for_anonymization(int) to service_role;
grant execute on function public.documents_due_for_deletion(int) to service_role;

-- ---------- scheduled jobs inside the database ----------
select cron.schedule('ronart-expire-holds', '* * * * *', $$select public.expire_stale_bookings();$$);
select cron.schedule('ronart-clean-rate-events', '17 3 * * *', $$delete from public.rate_events where created_at < now() - interval '2 days';$$);
