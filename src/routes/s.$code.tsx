import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, RefreshCw, ScanLine, Camera, AlertTriangle } from "lucide-react";

import { readIdCard } from "@/lib/attendance.functions";
import { getStudentSession, submitAttendance } from "@/lib/rollcall.functions";
import { downscaleToJpeg, fileToDataUrl, perceptualHash } from "@/lib/imaging";
import { matchesPattern } from "@/lib/session";


export const Route = createFileRoute("/s/$code")({
  head: () => ({
    meta: [
      { title: "Mark your attendance — RollCall" },
      { name: "description", content: "Scan your student ID and take a live selfie to mark yourself present." },
      { property: "og:title", content: "Mark your attendance — RollCall" },
      { property: "og:description", content: "Scan your student ID and take a live selfie to mark yourself present." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentFlow,
});

type SessionRow = {
  title: string;
  roll_format: string | null;
  roll_regex: string | null;
  is_open: boolean;
};

function StudentFlow() {
  const { code } = Route.useParams();
  const runReadIdCard = useServerFn(readIdCard);
  const runGetSession = useServerFn(getStudentSession);
  const runSubmit = useServerFn(submitAttendance);

  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [roll, setRoll] = useState("");
  const [name, setName] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [result, setResult] = useState<{ flagged: boolean; matched?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { session: s } = await runGetSession({ data: { code: code.toUpperCase() } });
        setSession(s ?? null);
      } catch {
        setSession(null);
      }
      setLoading(false);
    })();

  }, [code]);

  async function onIdSelected(file: File) {
    setError(null);
    setBusy("Reading your ID card…");
    try {
      const raw = await fileToDataUrl(file);
      const shrunk = await downscaleToJpeg(raw, 900, 0.75);
      setIdPhoto(shrunk);
      const res = await runReadIdCard({
        data: session?.roll_format ? { image: shrunk, format: session.roll_format } : { image: shrunk },
      });
      if (!res.readable && !res.rollNumber) {
        setError("That picture wasn't readable. Retake it in better light, or type your details below.");
      }
      setRoll(res.rollNumber);
      setName(res.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading the ID");
    } finally {
      setBusy(null);
    }
  }

  async function submit(selfieData: string) {
    if (!session) return;
    setError(null);
    setBusy("Checking your photo…");
    try {
      const hash = await perceptualHash(selfieData);
      const rollValue = roll.trim().toUpperCase();

      const { data: existing } = await supabase
        .from("attendance_records")
        .select("roll_number,selfie_hash")
        .eq("session_id", session.id);

      const already = (existing ?? []).find((r) => r.roll_number.toUpperCase() === rollValue);
      if (already) {
        setBusy(null);
        setError("This roll number has already been marked in this session.");
        return;
      }

      const clash = (existing ?? []).find(
        (r) => r.selfie_hash && hammingDistance(r.selfie_hash, hash) <= DUPLICATE_THRESHOLD,
      );

      const { error: dbError } = await supabase.from("attendance_records").insert({
        session_id: session.id,
        roll_number: rollValue,
        name: name.trim() || null,
        id_photo_url: idPhoto,
        selfie_url: selfieData,
        selfie_hash: hash,
        status: clash ? "flagged" : "present",
        flag_reason: clash ? "Selfie looks identical to another student's photo" : null,
        matched_roll: clash?.roll_number ?? null,
      });
      if (dbError) throw new Error("Could not save your attendance. Please try again.");

      setResult({ flagged: Boolean(clash), matched: clash?.roll_number ?? null });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
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
        <h1 className="text-2xl font-bold">Session not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The code <span className="code-chip">{code}</span> doesn&apos;t match any open session.
        </p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Back home
        </Link>
      </main>
    );
  }

  if (!session.is_open && step !== 3) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">This session is closed</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your teacher has stopped accepting attendance.</p>
      </main>
    );
  }

  const rollValid = roll.trim().length > 0 && matchesPattern(roll, session.roll_regex);

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Attendance</p>
      <h1 className="mt-1 text-2xl font-bold">{session.title}</h1>

      <ol className="mt-6 flex items-center gap-2 text-xs font-medium">
        {[1, 2, 3].map((n) => (
          <li
            key={n}
            className={`flex-1 rounded-full px-3 py-1.5 text-center ${
              step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {n === 1 ? "Scan ID" : n === 2 ? "Live selfie" : "Done"}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mt-5 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 1 && (
        <section className="panel mt-5 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScanLine className="size-4 text-accent" /> Scan your ID card
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Photograph the front of your student ID. Your roll number and name are read automatically.
          </p>

          {idPhoto && (
            <img src={idPhoto} alt="Your scanned ID card" className="mt-4 w-full rounded-lg border border-border" />
          )}

          <label className="mt-4 block">
            <span className="sr-only">Upload ID card photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={Boolean(busy)}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onIdSelected(f);
              }}
              className="block w-full cursor-pointer rounded-lg border border-dashed border-input bg-background px-3 py-4 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </label>

          {busy && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {busy}
            </p>
          )}

          {idPhoto && !busy && (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="roll" className="text-sm font-medium">
                  Roll number
                </label>
                <input
                  id="roll"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value.toUpperCase())}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {session.roll_format && (
                  <p className={`mt-1.5 text-xs ${rollValid ? "text-muted-foreground" : "text-destructive"}`}>
                    Expected format: <span className="font-mono">{session.roll_format}</span>
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="sname" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="sname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                disabled={!rollValid}
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Continue to selfie
              </button>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <SelfieStep
          busy={busy}
          selfie={selfie}
          onCapture={setSelfie}
          onSubmit={submit}
          onRetake={() => setSelfie(null)}
        />
      )}

      {step === 3 && result && (
        <section className="panel mt-5 p-6 text-center">
          {result.flagged ? (
            <>
              <AlertTriangle className="mx-auto size-10 text-warning" />
              <h2 className="mt-3 text-xl font-bold">Sent for teacher review</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your selfie matches the photo submitted for roll number{" "}
                <span className="font-mono">{result.matched}</span>. Your teacher will confirm you manually.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto size-10 text-success" />
              <h2 className="mt-3 text-xl font-bold">You&apos;re marked present</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-mono">{roll}</span> · {name || "Name not recorded"}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function SelfieStep({
  busy,
  selfie,
  onCapture,
  onSubmit,
  onRetake,
}: {
  busy: string | null;
  selfie: string | null;
  onCapture: (data: string) => void;
  onSubmit: (data: string) => void;
  onRetake: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCamError("Camera access was blocked. Allow the camera to take a live selfie.");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop, selfie]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / (video.videoWidth || 1)) * 480) || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stop();
    onCapture(canvas.toDataURL("image/jpeg", 0.75));
  }

  return (
    <section className="panel mt-5 p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Camera className="size-4 text-accent" /> Take a live selfie
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Look straight at the camera in good light. This picture is compared with everyone else&apos;s.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-muted">
        {selfie ? (
          <img src={selfie} alt="Your captured selfie" className="w-full" />
        ) : (
          <video ref={videoRef} playsInline muted className="w-full" />
        )}
      </div>

      {camError && <p className="mt-3 text-sm text-destructive">{camError}</p>}

      <div className="mt-4 flex gap-3">
        {selfie ? (
          <>
            <button
              onClick={onRetake}
              disabled={Boolean(busy)}
              className="flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-3 text-sm font-medium"
            >
              <RefreshCw className="size-4" /> Retake
            </button>
            <button
              onClick={() => onSubmit(selfie)}
              disabled={Boolean(busy)}
              className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {busy ?? "Submit attendance"}
            </button>
          </>
        ) : (
          <button
            onClick={capture}
            disabled={Boolean(camError)}
            className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Capture selfie
          </button>
        )}
      </div>
    </section>
  );
}
