-- Phase 4G: completed is committed separately so later migrations can safely
-- use the new enum value inside functions and constraints.
alter type public.service_job_status
  add value if not exists 'completed' after 'awaiting_acceptance';
