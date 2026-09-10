-- Enum additions are isolated so later migrations can safely use the values.
alter type public.service_job_status
  add value if not exists 'awaiting_additional_work_approval' before 'cancelled';
alter type public.service_job_status
  add value if not exists 'awaiting_acceptance' before 'cancelled';
