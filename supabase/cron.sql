-- Run this in Supabase SQL Editor after deploying the edge function
-- Requires pg_cron extension (enabled by default on Supabase)

select cron.schedule(
  'send-od-notifications',       -- job name
  '* * * * *',                   -- every minute
  $$
    select net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/send-od-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
