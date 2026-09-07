import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScanLine, Camera, FileDown, ShieldAlert, MapPin, Loader2, Mail, LogIn } from "lucide-react";

import { createSession as createSessionFn } from "@/lib/rollcall.functions";
import { getCreatorAccessState, requestAccess } from "@/lib/access.functions";
import { DEFAULT_RADIUS_M, readPosition } from "@/lib/geo";
import { RadiusPicker } from "@/components/RadiusPicker";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Free Anti-Proxy Attendance App for Teachers | RollCall" },
      {
        name: "description",
        content:
          "Free attendance management system that stops proxy attendance. Students scan their college ID and take a live selfie; geofenced sessions, duplicate alerts, absentee list and CSV export.",
      },
      { property: "og:title", content: "Free Anti-Proxy Attendance App for Teachers | RollCall" },
      {
        property: "og:description",
        content:
          "Create a session, share the code, let students verify with ID scan and a live selfie. Geofencing, duplicate photo alerts and one-click CSV export.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://attendancesessioncreator.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://attendancesessioncreator.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "RollCall",
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          url: "https://attendancesessioncreator.lovable.app/",
          description:
            "Anti-proxy attendance app for teachers. Students scan their college ID and take a live selfie; duplicate selfies are flagged and results export to CSV.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const runCreateSession = useServerFn(createSessionFn);
  const runGetAccess = useServerFn(getCreatorAccessState);
  const runRequestAccess = useServerFn(requestAccess);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockLocation, setLockLocation] = useState(true);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [locating, setLocating] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [accessStatus, setAccessStatus] = useState<"approved" | "rejected" | "revoked" | "pending" | null>(null);
  const [accessName, setAccessName] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void runGetAccess().then((state) => {
      if (!active) return;
      setSignedIn(state.signedIn);
      setAccessStatus(state.status);
    }).catch(() => {
      if (active) setAccessStatus(null);
    });
    return () => {
      active = false;
    };
  }, [runGetAccess]);

  async function submitAccessRequest(event: React.FormEvent) {
    event.preventDefault();
    setAccessBusy(true);
    setAccessMessage(null);
    try {
      await runRequestAccess({ data: { name: accessName, email: accessEmail, password: accessPassword } });
      setAccessMessage("Access request sent to administrator. You can create sessions after your request is approved.");
      setAccessName("");
      setAccessEmail("");
      setAccessPassword("");
    } catch (requestError) {
      setAccessMessage(requestError instanceof Error ? requestError.message : "Could not send the access request");
    } finally {
      setAccessBusy(false);
    }
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Give the session a name");
    setCreating(true);
    try {
      let here: { lat: number; lng: number } | null = null;
      if (lockLocation) {
        setLocating(true);
        try {
          const pos = await readPosition();
          here = { lat: pos.lat, lng: pos.lng };
        } catch (err) {
          setCreating(false);
          setLocating(false);
          return setError(
            `${err instanceof Error ? err.message : "Could not read your location."} You can also turn the classroom fence off.`,
          );
        } finally {
          setLocating(false);
        }
      }
      const { teacherCode } = await runCreateSession({
        data: {
          title: title.trim(),
          format: format.trim(),
          lat: here?.lat ?? null,
          lng: here?.lng ?? null,
          radiusM: here ? radiusM : null,
        },
      });
      navigate({ to: "/t/$teacherCode", params: { teacherCode } });
    } catch {
      setError("Could not create the session. Please try again.");
    } finally {
      setCreating(false);
    }
  }


  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
      <header className="mb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <ScanLine className="size-3.5" /> No accounts. No installs.
        </span>
        <h1 className="mt-5 text-4xl leading-tight font-bold sm:text-6xl">
          Attendance that <span className="text-accent">proves</span> who showed up.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Start a session for any number of students. Each student scans their ID card, then takes a
          live selfie. Identical selfies from two roll numbers get flagged for you, and the final
          present/absent list exports in one click.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-5">
        <section className="panel md:col-span-3 p-6 sm:p-8">
          {!signedIn || accessStatus !== "approved" ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Request creator access</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Get permission to create attendance sessions.</p>
                </div>
                <Mail className="size-5 shrink-0 text-accent" />
              </div>
              {signedIn ? (
                <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  {accessStatus === "pending" && "Your request is awaiting administrator approval."}
                  {accessStatus === "rejected" && "Your request was not approved. You can send a new request below."}
                  {accessStatus === "revoked" && "Your creator access was revoked. Contact the administrator to request access again."}
                  {!accessStatus && "We could not check your creator access right now."}
                </div>
              ) : null}
              <form onSubmit={submitAccessRequest} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="access-name" className="text-sm font-medium">Name</label>
                  <input
                    id="access-name"
                    required
                    value={accessName}
                    onChange={(event) => setAccessName(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="access-email" className="text-sm font-medium">Email</label>
                  <input
                    id="access-email"
                    type="email"
                    required
                    value={accessEmail}
                    onChange={(event) => setAccessEmail(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="access-password" className="text-sm font-medium">Password</label>
                  <input
                    id="access-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={accessPassword}
                    onChange={(event) => setAccessPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">Use at least 8 characters. You will use it after approval.</p>
                </div>
                {accessMessage && <p className="text-sm text-muted-foreground">{accessMessage}</p>}
                <button type="submit" disabled={accessBusy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {accessBusy && <Loader2 className="size-4 animate-spin" />}
                  Request Access
                </button>
              </form>
              {!signedIn && (
                <Link to="/auth" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-accent-foreground hover:underline">
                  <LogIn className="size-4" /> Already approved? Sign in
                </Link>
              )}
              <Link to="/admin" className="mt-3 block text-center text-xs text-muted-foreground hover:text-foreground">
                Administrator login
              </Link>
            </>
          ) : (
          <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Create a session</h2>
              <p className="mt-1 text-sm text-muted-foreground">You get a teacher dashboard and a student code.</p>
            </div>
            <Link to="/admin" className="text-sm font-medium text-accent-foreground hover:underline">Admin</Link>
          </div>
          <form onSubmit={createSession} className="mt-6 space-y-5">
            <div>
              <label htmlFor="title" className="text-sm font-medium">
                Session name
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="CSE 3rd year — DBMS lecture"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="format" className="text-sm font-medium">
                Roll number format <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="99AA9999"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Use <b className="font-mono">9</b> for a digit, <b className="font-mono">A</b> for a letter,{" "}
                <b className="font-mono">*</b> for anything else. Example:{" "}
                <span className="font-mono">99AA9999</span> matches <span className="font-mono">22CS0147</span>.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={lockLocation}
                  onChange={(e) => setLockLocation(e.target.checked)}
                  className="mt-0.5 size-4 accent-[hsl(var(--accent))]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="size-4 text-accent" /> Lock to this classroom
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Attendance is only accepted from devices near where you create the session, so a
                    shared link is useless outside the room.
                  </span>
                </span>
              </label>
              {lockLocation && (
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                  <label htmlFor="radius" className="text-xs text-muted-foreground">
                    Allowed distance
                  </label>
                  <RadiusPicker value={radiusM} onChange={setRadiusM} />
                </div>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              {locating ? "Getting your location…" : creating ? "Creating…" : "Create session"}
            </button>
          </form>
          </>
          )}
        </section>

        <section className="panel md:col-span-2 p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Join as a student</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter the code your teacher shared.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (code) navigate({ to: "/s/$code", params: { code } });
            }}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="code-chip w-full rounded-lg border border-input bg-background px-3 py-3 text-center text-lg outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Continue
            </button>
          </form>

          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <ScanLine className="mt-0.5 size-4 shrink-0 text-accent" /> Step 1 — scan your ID, details read
              automatically
            </li>
            <li className="flex gap-2.5">
              <Camera className="mt-0.5 size-4 shrink-0 text-accent" /> Step 2 — take a live selfie on camera
            </li>
            <li className="flex gap-2.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent" /> Same photo twice? The teacher is warned
            </li>
            <li className="flex gap-2.5">
              <FileDown className="mt-0.5 size-4 shrink-0 text-accent" /> Teacher exports present + absent as CSV
            </li>
          </ul>
        </section>
      </div>

      <section className="panel mt-6 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Built to stop proxy attendance</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          RollCall is a free online attendance management system for teachers, tutors and colleges.
          No student logins, no installs — you create a session and share one code.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="size-4 shrink-0 text-accent" /> ID scan + live selfie
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Each student scans their college ID card — name and roll number are read
              automatically — then takes a live selfie so one person can't mark many.
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 shrink-0 text-accent" /> Classroom geofencing
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Lock a session to your classroom radius. A shared link only works on devices inside
              the room, so a proxy outside can't submit.
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="size-4 shrink-0 text-accent" /> Duplicate detection
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The same selfie from two roll numbers is flagged for you. Review it, then mark
              present or absent manually.
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileDown className="size-4 shrink-0 text-accent" /> Present &amp; absent export
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Upload your student roster as a PDF and absentees stand out instantly. Export the
              final present list as CSV for your records.
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="size-4 shrink-0 text-accent" /> Any number of students
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Set your own roll-number format, from 10 students to 500. Students join with a code
              — no app install, no account.
            </p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 shrink-0 text-accent" /> Simple for teachers
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Request access once, sign in with your email, and create unlimited attendance
              sessions from any device.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
