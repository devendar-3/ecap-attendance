CREATE POLICY "sessions_no_direct_access" ON public.sessions
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "roster_students_no_direct_access" ON public.roster_students
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "attendance_records_no_direct_access" ON public.attendance_records
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE UNIQUE INDEX user_roles_one_admin
  ON public.user_roles (role)
  WHERE role = 'admin';