-- PostgreSQL requires an added enum value to commit before later migrations
-- can use it in constraints, functions, or DML.
alter type public.service_request_status
  add value if not exists 'technician_selected';
