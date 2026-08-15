import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScanLine, Camera, FileDown, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { randomCode } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RollCall — ID scan + live selfie attendance sessions" },
      {
        name: "description",
        content:
          "Create an attendance session in seconds. Students scan their ID card and take a live selfie; duplicate photos are flagged and results export to CSV.",
      },
      { property: "og:title", content: "RollCall — ID scan + live selfie attendance" },
      {
        property: "og:description",
        content:
          "Create a session, share the code, let students verify with ID scan and a live selfie. Absentees and duplicate photos surface automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Give the session a name");
    setCreating(true);
    const teacherCode = randomCode(10);
    const { data, error: dbError } = await supabase
      .from("sessions")
      .insert({
        title: title.trim(),
        join_code: randomCode(6),
        teacher_code: teacherCode,
        roll_format: format.trim(),
        roll_regex: format.trim() || null,
      })
      .select()
      .single();
    setCreating(false);
    if (dbError || !data) {
      setError("Could not create the session. Please try again.");
      return;
    }
    navigate({ to: "/t/$teacherCode", params: { teacherCode } });
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
          <h2 className="text-xl font-semibold">Create a session</h2>
          <p className="mt-1 text-sm text-muted-foreground">You get a teacher dashboard and a student code.</p>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create session"}
            </button>
          </form>
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
    </main>
  );
}
