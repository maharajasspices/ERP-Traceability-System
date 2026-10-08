-- =====================================================================
-- Fingerprint attendance: punches, policy, and the state machine
-- =====================================================================
--
-- DESIGN
-- ------
-- A worker only ever SCANS. They never press "Clock In" or "Tea".
-- The event is inferred from (a) where they already are and (b) the time.
--
--   First scan of the day .................. CLOCK_IN
--   Working, inside the tea window ......... TEA_START
--   On tea ............................... TEA_END
--   Working, inside the break window ...... BREAK_START
--   On break ............................. BREAK_END
--   Working, no break left today .......... CLOCK_OUT
--
-- This is why the hardware contract is deliberately tiny: a fingerprint
-- machine only ever sends  employee_id + timestamp. It does NOT send an
-- event type, so the device's own (counter-intuitive) state codes never
-- have to be interpreted or trusted.
--
-- Two tables:
--   fms_hr_attendance_punches  - immutable append-only scan log (the truth)
--   fms_hr_attendance_policy  - the shift/tea/break rules, editable, not
--                                hard-coded, so the business can tune them
--
-- The existing fms_hr_attendance daily row is a DERIVED summary and is
-- rebuilt from the punches by fms_hr_rebuild_attendance_day().
-- =====================================================================

-- 1) The scan log -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fms_hr_attendance_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.fms_hr_employees(id) ON DELETE CASCADE,
  punched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Inferred by the database, never trusted from the device.
  event_type TEXT NOT NULL CHECK (event_type IN
    ('CLOCK_IN', 'CLOCK_OUT', 'TEA_START', 'TEA_END', 'BREAK_START', 'BREAK_END')),
  -- Where the scan came from. 'device' is the future fingerprint machine.
  source TEXT NOT NULL DEFAULT 'kiosk' CHECK (source IN ('device', 'kiosk', 'manual')),
  device_id TEXT,
  -- Set by fms_hr_record_attendance_punch so a double scan cannot double-count.
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_punches_employee_time
  ON public.fms_hr_attendance_punches (employee_id, punched_at DESC);

-- One row per real event type per employee per day. This is the guard that
-- makes a duplicate scan a no-op instead of a second CLOCK_IN.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_punches_employee_day_event
  ON public.fms_hr_attendance_punches (
    employee_id,
    (punched_at AT TIME ZONE 'Africa/Johannesburg')::date,
    event_type
  ) WHERE note IS NULL;

-- 2) The policy (single row, id fixed so it is easy to reference) --------
CREATE TABLE IF NOT EXISTS public.fms_hr_attendance_policy (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  workday_start TIME NOT NULL DEFAULT '07:00',
  workday_end TIME NOT NULL DEFAULT '17:00',
  tea_start TIME NOT NULL DEFAULT '10:00',
  tea_minutes INTEGER NOT NULL DEFAULT 10,
  break_start TIME NOT NULL DEFAULT '12:00',
  break_minutes INTEGER NOT NULL DEFAULT 30,
  break_is_paid BOOLEAN NOT NULL DEFAULT false,
  -- How early/late a scan may still count as taking a given break.
  grace_minutes INTEGER NOT NULL DEFAULT 30,
  -- Arriving after this many minutes past workday_start is 'late'.
  late_after_minutes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.fms_hr_attendance_policy (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- 3) The state machine --------------------------------------------------
-- Returns the event a scan RIGHT NOW would be recorded as, without writing
-- anything. The kiosk calls this to PREVIEW the action ("scan now = start
-- your tea break") so the worker is never surprised.
--
-- Returned states:
--   CLOCK_IN | CLOCK_OUT | TEA_START | TEA_END | BREAK_START | BREAK_END
CREATE OR REPLACE FUNCTION public.fms_hr_attendance_next_event(
  p_employee_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_pol       fms_hr_attendance_policy%ROWTYPE;
  v_local     TIMESTAMP;
  v_day       DATE;
  v_last      fms_hr_attendance_punches%ROWTYPE;
  v_to_local  TIME;
  v_tea_taken BOOLEAN := false;
  v_brk_taken BOOLEAN := false;
  v_tea_win   BOOLEAN;
  v_brk_win   BOOLEAN;
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pol FROM public.fms_hr_attendance_policy WHERE id = 1;
  IF NOT FOUND THEN
    -- Fall back to the documented defaults rather than erroring.
    v_pol.workday_start       := '07:00';
    v_pol.workday_end         := '17:00';
    v_pol.tea_start           := '10:00';
    v_pol.tea_minutes         := 10;
    v_pol.break_start         := '12:00';
    v_pol.break_minutes       := 30;
    v_pol.break_is_paid       := false;
    v_pol.grace_minutes       := 30;
    v_pol.late_after_minutes  := 15;
  END IF;

  v_local := p_at AT TIME ZONE 'Africa/Johannesburg';
  v_day   := v_local::date;
  v_to_local := v_local::time;

  -- What was the last thing that happened today?
  SELECT * INTO v_last
  FROM public.fms_hr_attendance_punches
  WHERE employee_id = p_employee_id
    AND (punched_at AT TIME ZONE 'Africa/Johannesburg')::date = v_day
  ORDER BY punched_at DESC
  LIMIT 1;

  -- Not in yet, or already done for the day -> a scan means start.
  IF v_last.id IS NULL OR v_last.event_type = 'CLOCK_OUT' THEN
    RETURN 'CLOCK_IN';
  END IF;

  -- Returning from a break simply ends it.
  IF v_last.event_type = 'TEA_START'   THEN RETURN 'TEA_END';   END IF;
  IF v_last.event_type = 'BREAK_START' THEN RETURN 'BREAK_END'; END IF;

  -- Otherwise they are WORKING: the scan means they are leaving for a break,
  -- or going home. Which break is decided by the clock.
  SELECT
    EXISTS (SELECT 1 FROM public.fms_hr_attendance_punches
             WHERE employee_id = p_employee_id
               AND event_type = 'TEA_START'
               AND (punched_at AT TIME ZONE 'Africa/Johannesburg')::date = v_day),
    EXISTS (SELECT 1 FROM public.fms_hr_attendance_punches
             WHERE employee_id = p_employee_id
               AND event_type = 'BREAK_START'
               AND (punched_at AT TIME ZONE 'Africa/Johannesburg')::date = v_day)
  INTO v_tea_taken, v_brk_taken;

  -- A break is claimable from `grace_minutes` before it starts until
  -- `grace_minutes` after it would have ended.
  v_tea_win := (NOT v_tea_taken)
             AND v_to_local >= (v_pol.tea_start   - make_interval(mins => v_pol.grace_minutes))::time
             AND v_to_local <= ((v_pol.tea_start::time
                                + make_interval(mins => v_pol.tea_minutes + v_pol.grace_minutes)) % interval '24h')::time;

  v_brk_win := (NOT v_brk_taken)
             AND v_to_local >= (v_pol.break_start - make_interval(mins => v_pol.grace_minutes))::time
             AND v_to_local <= ((v_pol.break_start::time
                                + make_interval(mins => v_pol.break_minutes + v_pol.grace_minutes)) % interval '24h')::time;

  IF v_tea_win THEN RETURN 'TEA_START';   END IF;
  IF v_brk_win THEN RETURN 'BREAK_START'; END IF;

  -- No break left to take today (or far from any of them): they are going home.
  RETURN 'CLOCK_OUT';
END;
$$;

-- 4) Record a scan ------------------------------------------------------
-- The single write path. Both the kiosk and the future fingerprint device go
-- through here, so the rules can never diverge between them.
--
-- Returns the recorded event, or NULL when the scan was a duplicate (the
-- unique index makes a repeat scan a no-op instead of a second CLOCK_IN).
CREATE OR REPLACE FUNCTION public.fms_hr_record_attendance_punch(
  p_employee_id UUID,
  p_at            TIMESTAMPTZ DEFAULT now(),
  p_source        TEXT        DEFAULT 'kiosk',
  p_device_id     TEXT        DEFAULT NULL
) RETURNS TABLE (punch_id UUID, event_type TEXT, punched_at TIMESTAMPTZ, duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event    TEXT;
  v_row      fms_hr_attendance_punches%ROWTYPE;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  -- The device is not trusted to know what kind of punch this is.
  v_event := public.fms_hr_attendance_next_event(p_employee_id, COALESCE(p_at, now()));

  BEGIN
    INSERT INTO public.fms_hr_attendance_punches
      (employee_id, punched_at, event_type, source, device_id)
    VALUES
      (p_employee_id, COALESCE(p_at, now()), v_event,
       COALESCE(p_source, 'kiosk'), p_device_id)
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    -- A second scan of the same kind on the same day: tell the caller it was
    -- a repeat rather than raising, so the kiosk can show "already scanned".
    RETURN QUERY
      SELECT NULL::UUID, v_event, COALESCE(p_at, now()), TRUE;
    RETURN;
  END;

  PERFORM public.fms_hr_rebuild_attendance_day(
    p_employee_id,
    (COALESCE(p_at, now()) AT TIME ZONE 'Africa/Johannesburg')::date
  );

  RETURN QUERY SELECT v_row.id, v_row.event_type, v_row.punched_at, FALSE;
END;
$$;

-- 5) Roll the punch log up into the existing daily attendance row ---------
-- Keeps fms_hr_attendance (the table the rest of the app already reads)
-- as a derived daily summary, so nothing else has to change.
CREATE OR REPLACE FUNCTION public.fms_hr_rebuild_attendance_day(
  p_employee_id UUID,
  p_day         DATE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pol        fms_hr_attendance_policy%ROWTYPE;
  v_punches     fms_hr_attendance_punches%ROWTYPE[];
  v_clock_in    TIMESTAMPTZ;
  v_clock_out   TIMESTAMPTZ;
  v_tea_start   TIMESTAMPTZ;
  v_tea_end     TIMESTAMPTZ;
  v_brk_start   TIMESTAMPTZ;
  v_brk_end     TIMESTAMPTZ;
  v_worked_min  NUMERIC := 0;
  v_unpaid_min  NUMERIC := 0;
  v_status      TEXT;
  v_late_after  INTERVAL;
BEGIN
  SELECT * INTO v_pol FROM public.fms_hr_attendance_policy WHERE id = 1;
  IF NOT FOUND THEN
    v_pol.workday_start := '07:00'; v_pol.workday_end := '17:00';
    v_pol.tea_start := '10:00'; v_pol.tea_minutes := 10;
    v_pol.break_start := '12:00'; v_pol.break_minutes := 30;
    v_pol.break_is_paid := false; v_pol.late_after_minutes := 15;
  END IF;

  -- Today's punches, in order.
  SELECT ARRAY_AGG(p ORDER BY p.punched_at) INTO v_punches
  FROM public.fms_hr_attendance_punches p
  WHERE p.employee_id = p_employee_id
    AND (p.punched_at AT TIME ZONE 'Africa/Johannesburg')::date = p_day;

  IF v_punches IS NULL OR array_length(v_punches, 1) = 0 THEN
    DELETE FROM public.fms_hr_attendance
     WHERE employee_id = p_employee_id AND attendance_date = p_day;
    RETURN;
  END IF;

  SELECT
    max(p.punched_at) FILTER (WHERE p.event_type = 'CLOCK_IN'),
    max(p.punched_at) FILTER (WHERE p.event_type = 'CLOCK_OUT'),
    min(p.punched_at) FILTER (WHERE p.event_type = 'TEA_START'),
    max(p.punched_at) FILTER (WHERE p.event_type = 'TEA_END'),
    min(p.punched_at) FILTER (WHERE p.event_type = 'BREAK_START'),
    max(p.punched_at) FILTER (WHERE p.event_type = 'BREAK_END')
  INTO v_clock_in, v_clock_out, v_tea_start, v_tea_end, v_brk_start, v_brk_end
  FROM unnest(v_punches) p;

  -- Tea is a paid work break; the lunch break is unpaid, so only the latter
  -- is deducted from hours worked.
  IF v_tea_start IS NOT NULL AND v_tea_end IS NOT NULL THEN
    v_unpaid_min := v_unpaid_min; -- tea is paid, nothing to deduct
  END IF;

  IF v_brk_start IS NOT NULL AND v_brk_end IS NOT NULL THEN
    v_unpaid_min := extract(epoch FROM (v_brk_end - v_brk_start)) / 60;
  END IF;

  -- Worked span: clock in to clock out, or to "now" if they are still in.
  IF v_clock_in IS NOT NULL THEN
    v_worked_min := extract(epoch FROM (COALESCE(v_clock_out, now()) - v_clock_in)) / 60;
    v_worked_min := GREATEST(v_worked_min - COALESCE(v_unpaid_min, 0), 0);
  END IF;

  -- Status: not started yet, half day, late, or a full present day.
  v_late_after := make_interval(mins => v_pol.late_after_minutes);
  IF v_clock_in IS NULL THEN
    v_status := 'absent';
  ELSIF v_clock_in > ((p_day::date + v_pol.workday_start)::timestamptz + v_late_after) THEN
    v_status := 'late';
  ELSIF COALESCE(v_clock_out, now()) < ((p_day::date + v_pol.workday_end)::timestamptz - interval '4 hours') THEN
    v_status := 'half_day';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.fms_hr_attendance
    (employee_id, attendance_date, time_in, time_out, hours_worked, status, notes)
  VALUES
    (p_employee_id, p_day,
     (v_clock_in  AT TIME ZONE 'Africa/Johannesburg')::time,
     (v_clock_out AT TIME ZONE 'Africa/Johannesburg')::time,
     round((v_worked_min / 60.0)::numeric, 2),
     v_status,
     format('punches: %s', array_length(v_punches, 1)))
  ON CONFLICT (employee_id, attendance_date) DO UPDATE
    SET time_in      = EXCLUDED.time_in,
        time_out     = EXCLUDED.time_out,
        hours_worked = EXCLUDED.hours_worked,
        status       = EXCLUDED.status,
        notes        = EXCLUDED.notes;
END;
$$;

-- 6) RLS ----------------------------------------------------------------
ALTER TABLE public.fms_hr_attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fms_hr_attendance_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HR and admins can view punches" ON public.fms_hr_attendance_punches;
CREATE POLICY "HR and admins can view punches"
  ON public.fms_hr_attendance_punches
  FOR SELECT TO authenticated
  USING (
    public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  );

-- Staff may see their own punches; HR/admin see everything.
DROP POLICY IF EXISTS "Staff can view own punches" ON public.fms_hr_attendance_punches;
CREATE POLICY "Staff can view own punches"
  ON public.fms_hr_attendance_punches
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT e.id FROM public.fms_hr_employees e
      WHERE e.user_id = auth.uid()
    )
  );

-- Punches are append-only: inserted by the SECURITY DEFINER recorder only.
-- HR/admin may delete a bad scan, which rebuilds the day.
DROP POLICY IF EXISTS "HR and admins can delete punches" ON public.fms_hr_attendance_punches;
CREATE POLICY "HR and admins can delete punches"
  ON public.fms_hr_attendance_punches
  FOR DELETE TO authenticated
  USING (
    public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  );

DROP POLICY IF EXISTS "HR and admins can view policy" ON public.fms_hr_attendance_policy;
CREATE POLICY "HR and admins can view policy"
  ON public.fms_hr_attendance_policy
  FOR SELECT TO authenticated
  USING (
    public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  );

DROP POLICY IF EXISTS "HR and admins can edit policy" ON public.fms_hr_attendance_policy;
CREATE POLICY "HR and admins can edit policy"
  ON public.fms_hr_attendance_policy
  FOR ALL TO authenticated
  USING (
    public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  )
  WITH CHECK (
    public.fms_has_role(auth.uid(), 'hr_user'::fms_role)
    OR public.fms_has_role(auth.uid(), 'system_admin'::fms_role)
  );

-- 7) Grants -------------------------------------------------------------
-- The kiosk and the future device call the recorder through PostgREST, so the
-- functions must be executable by a logged-in user.
GRANT EXECUTE ON FUNCTION public.fms_hr_attendance_next_event(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fms_hr_record_attendance_punch(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fms_hr_rebuild_attendance_day(UUID, DATE) TO authenticated;

-- The recorder rebuilds the daily row as SECURITY DEFINER, so it needs rights
-- on that table even though users cannot insert into it directly.
GRANT INSERT, UPDATE, DELETE ON public.fms_hr_attendance_punches TO authenticated;
GRANT SELECT ON public.fms_hr_attendance_policy TO authenticated;
