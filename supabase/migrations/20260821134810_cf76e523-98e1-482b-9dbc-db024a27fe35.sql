ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision,
  ADD COLUMN IF NOT EXISTS geo_radius_m integer;

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS distance_m integer;