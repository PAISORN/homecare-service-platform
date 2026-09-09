-- Enum additions live in their own migration so following migrations can use
-- the new values safely even when migrations run inside transactions.
alter type public.service_job_status
  add value if not exists 'technician_en_route' before 'cancelled';
alter type public.service_job_status
  add value if not exists 'technician_arrived' before 'cancelled';
alter type public.service_job_status
  add value if not exists 'in_progress' before 'cancelled';
