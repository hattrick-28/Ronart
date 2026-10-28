-- =====================================================================
-- Sinkronizimi me Beds24 çdo minutë (pg_cron + pg_net)
-- Run AFTER the site is live on Vercel. Replace the 3 placeholders:
--   <SITE_URL>        e.g. https://ronartapartments.com  (no trailing slash)
--   <CRON_SECRET>     same value as CRON_SECRET in Vercel
--   <VERCEL_BYPASS>   Vercel → Settings → Deployment Protection →
--                     Protection Bypass for Automation (leave '' if the
--                     site is public and has no protection)
-- =====================================================================

select vault.create_secret('<CRON_SECRET>', 'ronart_cron_secret');
select vault.create_secret('<VERCEL_BYPASS>', 'ronart_vercel_bypass');

select cron.schedule(
  'ronart-sync',
  '* * * * *',
  $$
  select net.http_get(
    url := '<SITE_URL>/api/cron/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ronart_cron_secret'),
      'x-vercel-protection-bypass', (select decrypted_secret from vault.decrypted_secrets where name = 'ronart_vercel_bypass')
    ),
    timeout_milliseconds := 25000
  );
  $$
);

-- To change the URL later:
--   select cron.unschedule('ronart-sync');  then run the schedule above again.
-- To change a secret later:
--   select vault.update_secret((select id from vault.secrets where name = 'ronart_cron_secret'), '<NEW_VALUE>');
