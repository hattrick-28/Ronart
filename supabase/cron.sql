-- Run once after deploying (replace the two placeholders). Stores the cron secret in Supabase Vault
-- and calls the sync endpoint every minute: expires holds, pushes changes to Beds24, pulls missed bookings.
select vault.create_secret('<CRON_SECRET>', 'ronart_cron_secret');
select cron.schedule('ronart-sync', '* * * * *', $$
  select net.http_get(
    url := 'https://<YOUR-DOMAIN>/api/cron/sync',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ronart_cron_secret')),
    timeout_milliseconds := 25000);
$$);
