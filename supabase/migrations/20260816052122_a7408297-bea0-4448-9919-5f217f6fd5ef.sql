
DROP POLICY IF EXISTS attendance_public_delete ON public.attendance_records;
DROP POLICY IF EXISTS attendance_public_insert ON public.attendance_records;
DROP POLICY IF EXISTS attendance_public_read ON public.attendance_records;
DROP POLICY IF EXISTS attendance_public_update ON public.attendance_records;

DROP POLICY IF EXISTS roster_public_delete ON public.roster_students;
DROP POLICY IF EXISTS roster_public_insert ON public.roster_students;
DROP POLICY IF EXISTS roster_public_read ON public.roster_students;
DROP POLICY IF EXISTS roster_public_update ON public.roster_students;

DROP POLICY IF EXISTS sessions_public_insert ON public.sessions;
DROP POLICY IF EXISTS sessions_public_read ON public.sessions;
DROP POLICY IF EXISTS sessions_public_update ON public.sessions;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.attendance_records FROM anon, authenticated;
REVOKE ALL ON public.roster_students FROM anon, authenticated;
REVOKE ALL ON public.sessions FROM anon, authenticated;

GRANT ALL ON public.attendance_records TO service_role;
GRANT ALL ON public.roster_students TO service_role;
GRANT ALL ON public.sessions TO service_role;

ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_records;
