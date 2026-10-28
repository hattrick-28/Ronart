-- =====================================================================
-- Make the owner account. First:
--   Supabase → Authentication → Users → Add user → Create new user
--   (email + strong password, tick "Auto Confirm User").
-- Then replace <OWNER_EMAIL> and <OWNER_NAME> and run this.
-- On first login the CRM asks to set up 2FA (Google Authenticator / Authy).
-- Reception staff are invited later from the CRM: Cilësimet → Stafi.
-- =====================================================================

insert into public.staff (user_id, full_name, role)
select id, '<OWNER_NAME>', 'owner'
from auth.users
where lower(email) = lower('<OWNER_EMAIL>')
on conflict (user_id) do update set role = 'owner', active = true;

-- Check: must return 1 row
select s.full_name, s.role, u.email from public.staff s join auth.users u on u.id = s.user_id;
