-- Enum values are isolated in their own migration because PostgreSQL cannot
-- safely use a newly-added enum value until the creating transaction commits.
alter type public.service_request_status add value if not exists 'matching';
