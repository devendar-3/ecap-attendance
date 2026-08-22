import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileDown,
  FileUp,
  Loader2,
  Trash2,
  UserX,
  Users,
  MapPin,
} from "lucide-react";

import { readRosterFile } from "@/lib/attendance.functions";
import {
  deleteRecord,
  getTeacherDashboard,
  markRosterPresent as markRosterPresentFn,
  saveRoster,
  setRecordStatus,
  setSessionOpen,
  setSessionGeofence,
} from "@/lib/rollcall.functions";
import { RADIUS_OPTIONS, readPosition } from "@/lib/geo";
import { fileToDataUrl } from "@/lib/imaging";
import { downloadFile, toCsv } from "@/lib/session";


export const Route = createFileRoute("/t/$teacherCode")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — RollCall" },
      { name: "description", content: "Track live attendance, review flagged selfies, spot absentees and export the list." },
      { property: "og:title", content: "Teacher dashboard — RollCall" },
      {
        property: "og:description",
        content: "Track live attendance, review flagged selfies, spot absentees and export the list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherDashboard,
});

type SessionRow = {
  id: string;
  title: string;
  join_code: string;
  roll_format: string | null;
  is_open: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_m: number | null;
};

type Record_ = {
  id: string;
  roll_number: string;
  name: string | null;
  id_photo_url: string | null;
  selfie_url: string | null;
  status: string;
  flag_reason: string | null;
  matched_roll: string | null;
  distance_m: number | null;
  created_at: string;
};

type Roster = { id: string; roll_number: string; name: string | null };

function TeacherDashboard() {
  const { teacherCode } = Route.useParams();
  const runReadRoster = useServerFn(readRosterFile);
  const runDashboard = useServerFn(getTeacherDashboard);
  const runSaveRoster = useServerFn(saveRoster);
  const runSetStatus = useServerFn(setRecordStatus);
  const runDeleteRecord = useServerFn(deleteRecord);
  const runMarkPresent = useServerFn(markRosterPresentFn);
  const runSetOpen = useServerFn(setSessionOpen);
  const runSetGeofence = useServerFn(setSessionGeofence);
  const [fenceBusy, setFenceBusy] = useState(false);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [records, setRecords] = useState<Record_[]>([]);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"present" | "flagged" | "absent">("present");

  const refresh = useCallback(async () => {
    const res = await runDashboard({ data: { teacherCode } });
    setSession((res.session as SessionRow) ?? null);
    setRecords((res.records as Record_[]) ?? []);
    setRoster((res.roster as Roster[]) ?? []);
  }, [runDashboard, teacherCode]);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch {
        setSession(null);
      }
      setLoading(false);
    })();
  }, [refresh]);

  // Tables are server-guarded, so poll for new submissions instead of subscribing.
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => void refresh().catch(() => undefined), 5000);
    return () => clearInterval(timer);
  }, [session, refresh]);

  async function uploadRoster(file: File) {
    if (!session) return;
    setUploading(true);
    setNotice(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { students } = await runReadRoster({ data: { file: dataUrl, filename: file.name } });
      if (students.length === 0) {
        setNotice("No student rows could be read from that file.");
        return;
      }
      await runSaveRoster({ data: { teacherCode, students } });
      setNotice(`Added ${students.length} students to the class list.`);
      await refresh();
      setTab("absent");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await runSetStatus({ data: { teacherCode, recordId: id, status } });
    await refresh();
  }

  async function removeRecord(id: string) {
    await runDeleteRecord({ data: { teacherCode, recordId: id } });
    await refresh();
  }

  async function markRosterPresent(student: Roster) {
    await runMarkPresent({ data: { teacherCode, rollNumber: student.roll_number, name: student.name } });
    await refresh();
  }

  async function toggleFence(enable: boolean, radiusM: number) {
    if (!session) return;
    setFenceBusy(true);
    setNotice(null);
    try {
      if (enable) {
        const pos = await readPosition();
        await runSetGeofence({ data: { teacherCode, lat: pos.lat, lng: pos.lng, radiusM } });
      } else {
        await runSetGeofence({ data: { teacherCode, lat: null, lng: null, radiusM: null } });
      }
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update the classroom lock");
    } finally {
      setFenceBusy(false);
    }
  }

  async function toggleOpen() {
    if (!session) return;
    await runSetOpen({ data: { teacherCode, isOpen: !session.is_open } });
    setSession({ ...session, is_open: !session.is_open });
  }


  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">Dashboard not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This teacher link is not valid.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Back home
        </Link>
      </main>
    );
  }

  const present = records.filter((r) => r.status === "present");
  const flagged = records.filter((r) => r.status === "flagged");
  const markedRolls = new Set(records.map((r) => r.roll_number.toUpperCase()));
  const absent = roster.filter((s) => !markedRolls.has(s.roll_number.toUpperCase()));
  const studentUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${session.join_code}` : "";

  function exportCsv() {
    const rows = [
      ...records.map((r) => ({
        roll_number: r.roll_number,
        name: r.name ?? "",
        status: r.status === "flagged" ? "needs review" : "present",
        note: r.flag_reason ?? "",
        marked_at: new Date(r.created_at).toLocaleString(),
      })),
      ...absent.map((s) => ({
        roll_number: s.roll_number,
        name: s.name ?? "",
        status: "absent",
        note: "",
        marked_at: "",
      })),
    ];
    downloadFile(
      `attendance-${session!.join_code}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows),
      "text/csv",
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Teacher dashboard</p>
          <h1 className="mt-1 text-3xl font-bold">{session.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleOpen}
            className="rounded-lg border border-input px-3 py-2 text-sm font-medium"
          >
            {session.is_open ? "Close session" : "Reopen session"}
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <FileDown className="size-4" /> Export CSV
          </button>
        </div>
      </div>

      <section className="panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Student join code</p>
          <p className="code-chip mt-1 text-3xl font-bold">{session.join_code}</p>
        </div>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(studentUrl);
            setNotice("Student link copied.");
          }}
          className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium"
        >
          <Copy className="size-4" /> Copy student link
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm font-medium">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {uploading ? "Reading list…" : "Upload class list (PDF)"}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadRoster(f);
            }}
          />
        </label>
      </section>

      <section className="panel mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <MapPin className={`mt-0.5 size-5 ${session.geo_lat != null ? "text-success" : "text-muted-foreground"}`} />
          <div>
            <p className="text-sm font-medium">
              {session.geo_lat != null ? "Classroom lock is on" : "Classroom lock is off"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {session.geo_lat != null
                ? `Only devices within ${session.geo_radius_m ?? 100} m of the spot you locked can mark attendance — sharing the link outside the room won't work.`
                : "Anyone with the link can mark attendance from anywhere. Lock it to your current spot to stop proxy attendance."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.geo_lat == null && (
            <select
              value={session.geo_radius_m ?? 100}
              onChange={(e) => void toggleFence(true, Number(e.target.value))}
              className="rounded-md border border-input bg-background px-2 py-2 text-xs"
              disabled={fenceBusy}
            >
              <option value="">Lock within…</option>
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Lock within {r} m
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => void toggleFence(session.geo_lat == null, session.geo_radius_m ?? 100)}
            disabled={fenceBusy}
            className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {fenceBusy && <Loader2 className="size-4 animate-spin" />}
            {session.geo_lat != null ? "Turn off lock" : "Lock to my location"}
          </button>
        </div>
      </section>

      {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Present" value={present.length} tone="success" />
        <Stat label="Needs review" value={flagged.length} tone="warning" />
        <Stat label="Absent" value={absent.length} tone="destructive" />
        <Stat label="On class list" value={roster.length} tone="muted" />
      </div>

      <nav className="mt-8 flex gap-2 border-b border-border">
        {(["present", "flagged", "absent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {t === "flagged" ? "Needs review" : t}
          </button>
        ))}
      </nav>

      {tab === "present" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {present.length === 0 && <Empty text="No one has marked attendance yet." />}
          {present.map((r) => (
            <article key={r.id} className="panel flex gap-3 p-3">
              {r.selfie_url ? (
                <img src={r.selfie_url} alt={`Selfie of ${r.roll_number}`} className="size-16 rounded-lg object-cover" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-lg bg-muted">
                  <Users className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold">{r.roll_number}</p>
                <p className="truncate text-sm text-muted-foreground">{r.name ?? "—"}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="size-3.5" /> Present
                </p>
              </div>
              <button
                onClick={() => void removeRecord(r.id)}
                aria-label={`Remove ${r.roll_number}`}
                className="self-start rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </article>
          ))}
        </div>
      )}

      {tab === "flagged" && (
        <div className="mt-5 space-y-3">
          {flagged.length === 0 && <Empty text="No duplicate photos detected." />}
          {flagged.map((r) => {
            const other = records.find(
              (x) => x.roll_number.toUpperCase() === (r.matched_roll ?? "").toUpperCase(),
            );
            return (
              <article key={r.id} className="panel border-warning/40 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
                  <AlertTriangle className="size-4 text-warning" />
                  Same photo submitted by two roll numbers
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Compare record={r} caption="Submitted now" />
                  {other && <Compare record={other} caption="Earlier submission" />}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void setStatus(r.id, "present")}
                    className="rounded-lg bg-success px-3 py-2 text-sm font-semibold text-success-foreground"
                  >
                    Mark {r.roll_number} present
                  </button>
                  <button
                    onClick={() => void removeRecord(r.id)}
                    className="rounded-lg border border-input px-3 py-2 text-sm font-medium"
                  >
                    Reject entry
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "absent" && (
        <div className="mt-5">
          {roster.length === 0 ? (
            <Empty text="Upload a class list PDF to see who is missing." />
          ) : absent.length === 0 ? (
            <Empty text="Everyone on the class list is accounted for." />
          ) : (
            <ul className="panel divide-y divide-border">
              {absent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <UserX className="size-4 text-destructive" />
                    <div>
                      <p className="font-mono text-sm font-semibold">{s.roll_number}</p>
                      <p className="text-sm text-muted-foreground">{s.name ?? "—"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => void markRosterPresent(s)}
                    className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium"
                  >
                    Mark present
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

function Compare({ record, caption }: { record: Record_; caption: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{caption}</p>
      <div className="mt-1.5 flex gap-2">
        {record.selfie_url && (
          <img src={record.selfie_url} alt={`Selfie of ${record.roll_number}`} className="size-24 rounded-lg object-cover" />
        )}
        {record.id_photo_url && (
          <img src={record.id_photo_url} alt={`ID card of ${record.roll_number}`} className="h-24 rounded-lg object-cover" />
        )}
      </div>
      <p className="mt-1.5 font-mono text-sm font-semibold">{record.roll_number}</p>
      <p className="text-sm text-muted-foreground">{record.name ?? "—"}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="panel p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="panel p-8 text-center text-sm text-muted-foreground">{text}</p>;
}
