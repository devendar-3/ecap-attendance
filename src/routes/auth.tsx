import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { checkCreatorEmail } from "@/lib/access.functions";
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
  const runCheckCreatorEmail = useServerFn(checkCreatorEmail);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const access = await runCheckCreatorEmail({ data: { email: normalizedEmail } });
      if (access.status !== "approved") {
        setError(
          access.status === "pending"
            ? "Your creator access request is still awaiting approval."
            : access.status === "revoked"
              ? "Your creator access has been revoked."
              : "This email is not approved to create sessions.",
        );
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (signInError) {
        setError("We could not send the sign-in link. Please try again.");
        return;
      }
      setSent(true);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
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
           Enter the email approved by the administrator. We will send a secure sign-in link — no password needed.
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
           {error && <p className="text-sm text-destructive">{error}</p>}
           {sent && (
             <p className="text-sm text-success">
               Sign-in link sent. Open it from your email to create attendance sessions.
             </p>
           )}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
             {busy ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
        <Link to="/" className="mt-5 block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to RollCall
        </Link>
      </section>
    </main>
  );
}