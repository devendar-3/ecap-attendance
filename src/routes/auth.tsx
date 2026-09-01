import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RollCall" },
      { name: "description", content: "Sign in to create attendance sessions or administer creator approvals." },
      { property: "og:title", content: "Sign in — RollCall" },
      { property: "og:description", content: "Sign in to create attendance sessions or administer creator approvals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("That email or password was not accepted.");
      setBusy(false);
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-12">
      <section className="panel w-full p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">RollCall access</p>
            <h1 className="text-2xl font-bold">Sign in</h1>
          </div>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          Use the existing account approved for session creation or administration.
        </p>
        <form className="mt-6 space-y-4" onSubmit={signIn}>
          <div>
            <label htmlFor="auth-email" className="text-sm font-medium">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="text-sm font-medium">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link to="/" className="mt-5 block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to RollCall
        </Link>
      </section>
    </main>
  );
}