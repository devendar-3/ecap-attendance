CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  teacher_code TEXT NOT NULL UNIQUE,
  roll_format TEXT NOT NULL DEFAULT '',
  roll_regex TEXT,
  expected_count INT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_public_read" ON public.sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sessions_public_insert" ON public.sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "sessions_public_update" ON public.sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.roster_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, roll_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_students TO anon, authenticated;
GRANT ALL ON public.roster_students TO service_role;
ALTER TABLE public.roster_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roster_public_read" ON public.roster_students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "roster_public_insert" ON public.roster_students FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "roster_public_update" ON public.roster_students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "roster_public_delete" ON public.roster_students FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  name TEXT,
  id_photo_url TEXT,
  selfie_url TEXT,
  selfie_hash TEXT,
  status TEXT NOT NULL DEFAULT 'present',
  flag_reason TEXT,
  matched_roll TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, roll_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO anon, authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_public_read" ON public.attendance_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "attendance_public_insert" ON public.attendance_records FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "attendance_public_update" ON public.attendance_records FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "attendance_public_delete" ON public.attendance_records FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_attendance_session ON public.attendance_records(session_id);
CREATE INDEX idx_roster_session ON public.roster_students(session_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;