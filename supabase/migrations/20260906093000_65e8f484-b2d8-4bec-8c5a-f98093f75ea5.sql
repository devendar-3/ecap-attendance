ALTER TABLE public.access_requests
  ADD COLUMN password_hash TEXT,
  ADD COLUMN password_salt TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO service_role;