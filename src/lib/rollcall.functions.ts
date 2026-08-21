import { createServerFn } from "@tanstack/react-start";

import { hammingDistance, DUPLICATE_THRESHOLD } from "./imaging";
import { ACCURACY_TOLERANCE_M, distanceMeters } from "./geo";
import { randomCode } from "./session";

/**
 * All database access for RollCall runs here. The tables are locked down (no
 * anon/authenticated grants), so the only way in is through these handlers,
 * which first verify the caller knows the student join code or the teacher's
 * private code. Teacher codes are never returned to student-facing callers.
 */

const MAX_IMAGE_CHARS = 3_000_000;

function str(value: unknown, max: number): string {
  if (typeof value !== "string") throw new Error("Invalid input");
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error("Input is too long");
  return trimmed;
}

function optionalImage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value.startsWith("data:image/")) throw new Error("Invalid image");
  if (value.length > MAX_IMAGE_CHARS) throw new Error("Image is too large");
  return value;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function coord(value: unknown, limit: number): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) throw new Error("Invalid location");
  return n;
}

function radius(value: unknown): number | null {
  if (value == null) return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 20 || n > 5000) throw new Error("Invalid radius");
  return n;
}

/** Resolves the session behind a teacher code, or throws. */
async function requireTeacherSession(teacherCode: string) {
  const db = await admin();
  const { data } = await db
    .from("sessions")
    .select("id,title,join_code,roll_format,is_open,geo_lat,geo_lng,geo_radius_m")
    .eq("teacher_code", teacherCode)
    .maybeSingle();
  if (!data) throw new Error("Not found");
  return { db, session: data };
}

async function requireStudentSession(joinCode: string) {
  const db = await admin();
  const { data } = await db
    .from("sessions")
    .select("id,title,roll_format,roll_regex,is_open,geo_lat,geo_lng,geo_radius_m")
    .eq("join_code", joinCode)
    .maybeSingle();
  if (!data) return { db, session: null };
  return { db, session: data };
}

export const createSession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      title: string;
      format?: string;
      lat?: number | null;
      lng?: number | null;
      radiusM?: number | null;
    }) => ({
      title: str(data?.title, 120),
      format: str(data?.format ?? "", 60),
      lat: coord(data?.lat ?? null, 90),
      lng: coord(data?.lng ?? null, 180),
      radiusM: radius(data?.radiusM ?? null),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Give the session a name");
    const db = await admin();
    const teacherCode = randomCode(10);
    const fenced = data.lat != null && data.lng != null;
    const { error } = await db.from("sessions").insert({
      title: data.title,
      join_code: randomCode(6),
      teacher_code: teacherCode,
      roll_format: data.format,
      roll_regex: data.format || null,
      geo_lat: fenced ? data.lat : null,
      geo_lng: fenced ? data.lng : null,
      geo_radius_m: fenced ? (data.radiusM ?? 100) : null,
    });
    if (error) throw new Error("Could not create the session");
    return { teacherCode };
  });

/** Turn the location fence on (at the teacher's current spot) or off. */
export const setSessionGeofence = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { teacherCode: string; lat?: number | null; lng?: number | null; radiusM?: number | null }) => ({
      teacherCode: str(data?.teacherCode, 32),
      lat: coord(data?.lat ?? null, 90),
      lng: coord(data?.lng ?? null, 180),
      radiusM: radius(data?.radiusM ?? null),
    }),
  )
  .handler(async ({ data }) => {
    const { db, session } = await requireTeacherSession(data.teacherCode);
    const fenced = data.lat != null && data.lng != null;
    await db
      .from("sessions")
      .update({
        geo_lat: fenced ? data.lat : null,
        geo_lng: fenced ? data.lng : null,
        geo_radius_m: fenced ? (data.radiusM ?? 100) : null,
      })
      .eq("id", session.id);
    return { ok: true };
  });

/** Public view of a session — deliberately excludes teacher_code and the row id. */
export const getStudentSession = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => ({ code: str(data?.code, 16).toUpperCase() }))
  .handler(async ({ data }) => {
    const { session } = await requireStudentSession(data.code);
    if (!session) return { session: null };
    return {
      session: {
        title: session.title,
        roll_format: session.roll_format,
        roll_regex: session.roll_regex,
        is_open: session.is_open,
        // Never expose the exact classroom coordinates — only that a fence exists.
        requires_location: session.geo_lat != null && session.geo_lng != null,
        geo_radius_m: session.geo_radius_m,
      },
    };
  });

export const submitAttendance = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      code: string;
      rollNumber: string;
      name?: string;
      idPhoto?: string | null;
      selfie: string;
      selfieHash: string;
      lat?: number | null;
      lng?: number | null;
      accuracy?: number | null;
    }) => ({
      code: str(data?.code, 16).toUpperCase(),
      rollNumber: str(data?.rollNumber, 40).toUpperCase(),
      name: str(data?.name ?? "", 120),
      idPhoto: optionalImage(data?.idPhoto ?? null),
      selfie: optionalImage(data?.selfie),
      selfieHash: str(data?.selfieHash, 64),
      lat: coord(data?.lat ?? null, 90),
      lng: coord(data?.lng ?? null, 180),
      accuracy: data?.accuracy == null ? null : Math.max(0, Number(data.accuracy) || 0),
    }),
  )
  .handler(async ({ data }) => {
    const { db, session } = await requireStudentSession(data.code);
    if (!session) throw new Error("Session not found");
    if (!session.is_open) throw new Error("This session is closed");
    if (!data.rollNumber) throw new Error("A roll number is required");

    // Location fence — checked on the server so it can't be skipped from the browser.
    let distance: number | null = null;
    if (session.geo_lat != null && session.geo_lng != null) {
      if (data.lat == null || data.lng == null) {
        throw new Error("This session needs your location. Allow location access and try again.");
      }
      distance = Math.round(
        distanceMeters(session.geo_lat, session.geo_lng, data.lat, data.lng),
      );
      const allowed =
        (session.geo_radius_m ?? 100) + Math.min(data.accuracy ?? 0, ACCURACY_TOLERANCE_M);
      if (distance > allowed) {
        throw new Error(
          `You're about ${distance} m from where this session was started. You must be inside the classroom to mark attendance.`,
        );
      }
    }


    const { data: existing } = await db
      .from("attendance_records")
      .select("roll_number,selfie_hash")
      .eq("session_id", session.id);

    const rows = existing ?? [];
    if (rows.some((r) => r.roll_number.toUpperCase() === data.rollNumber)) {
      throw new Error("This roll number has already been marked in this session.");
    }

    const clash = rows.find(
      (r) => r.selfie_hash && hammingDistance(r.selfie_hash, data.selfieHash) <= DUPLICATE_THRESHOLD,
    );

    const { error } = await db.from("attendance_records").insert({
      session_id: session.id,
      roll_number: data.rollNumber,
      name: data.name || null,
      id_photo_url: data.idPhoto,
      selfie_url: data.selfie,
      selfie_hash: data.selfieHash,
      status: clash ? "flagged" : "present",
      flag_reason: clash ? "Selfie looks identical to another student's photo" : null,
      matched_roll: clash?.roll_number ?? null,
      distance_m: distance,
    });
    if (error) throw new Error("Could not save your attendance. Please try again.");

    return { flagged: Boolean(clash), matched: clash?.roll_number ?? null };
  });

export const getTeacherDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string }) => ({ teacherCode: str(data?.teacherCode, 32) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: session } = await db
      .from("sessions")
      .select("id,title,join_code,roll_format,is_open,geo_lat,geo_lng,geo_radius_m")
      .eq("teacher_code", data.teacherCode)
      .maybeSingle();
    if (!session) return { session: null, records: [], roster: [] };

    const [{ data: records }, { data: roster }] = await Promise.all([
      db.from("attendance_records").select("*").eq("session_id", session.id).order("created_at"),
      db
        .from("roster_students")
        .select("id,roll_number,name")
        .eq("session_id", session.id)
        .order("roll_number"),
    ]);

    return { session, records: records ?? [], roster: roster ?? [] };
  });

export const setRecordStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string; recordId: string; status: string }) => ({
    teacherCode: str(data?.teacherCode, 32),
    recordId: str(data?.recordId, 64),
    status: str(data?.status, 20),
  }))
  .handler(async ({ data }) => {
    if (!["present", "flagged", "absent"].includes(data.status)) throw new Error("Invalid status");
    const { db, session } = await requireTeacherSession(data.teacherCode);
    await db
      .from("attendance_records")
      .update({ status: data.status, flag_reason: null })
      .eq("id", data.recordId)
      .eq("session_id", session.id);
    return { ok: true };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string; recordId: string }) => ({
    teacherCode: str(data?.teacherCode, 32),
    recordId: str(data?.recordId, 64),
  }))
  .handler(async ({ data }) => {
    const { db, session } = await requireTeacherSession(data.teacherCode);
    await db.from("attendance_records").delete().eq("id", data.recordId).eq("session_id", session.id);
    return { ok: true };
  });

export const markRosterPresent = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string; rollNumber: string; name?: string | null }) => ({
    teacherCode: str(data?.teacherCode, 32),
    rollNumber: str(data?.rollNumber, 40).toUpperCase(),
    name: str(data?.name ?? "", 120),
  }))
  .handler(async ({ data }) => {
    const { db, session } = await requireTeacherSession(data.teacherCode);
    await db.from("attendance_records").insert({
      session_id: session.id,
      roll_number: data.rollNumber,
      name: data.name || null,
      status: "present",
      flag_reason: "Marked manually by teacher",
    });
    return { ok: true };
  });

export const saveRoster = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string; students: Array<{ roll_number: string; name: string | null }> }) => {
    if (!Array.isArray(data?.students)) throw new Error("Invalid class list");
    if (data.students.length > 2000) throw new Error("That class list is too large");
    return {
      teacherCode: str(data.teacherCode, 32),
      students: data.students.map((s) => ({
        roll_number: str(s?.roll_number, 40).toUpperCase(),
        name: s?.name == null ? null : str(s.name, 120) || null,
      })),
    };
  })
  .handler(async ({ data }) => {
    const { db, session } = await requireTeacherSession(data.teacherCode);
    const { error } = await db.from("roster_students").upsert(
      data.students.map((s) => ({ session_id: session.id, roll_number: s.roll_number, name: s.name })),
      { onConflict: "session_id,roll_number" },
    );
    if (error) throw new Error("Could not save the class list");
    return { ok: true };
  });

export const setSessionOpen = createServerFn({ method: "POST" })
  .inputValidator((data: { teacherCode: string; isOpen: boolean }) => ({
    teacherCode: str(data?.teacherCode, 32),
    isOpen: Boolean(data?.isOpen),
  }))
  .handler(async ({ data }) => {
    const { db, session } = await requireTeacherSession(data.teacherCode);
    await db.from("sessions").update({ is_open: data.isOpen }).eq("id", session.id);
    return { ok: true };
  });
