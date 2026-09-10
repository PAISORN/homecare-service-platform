-- Finalize due acceptance windows inside PostgreSQL so completion does not
-- depend on a phone staying open. This job changes workflow state only; it
-- never moves money while payment_mode is fake_sandbox.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'homecare-process-due-service-job-acceptances',
  '*/5 * * * *',
  $schedule$select public.process_due_service_job_acceptances(100);$schedule$
);
