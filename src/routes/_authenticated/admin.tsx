import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Clock3, Loader2, LogOut, ShieldAlert, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  bootstrapAdmin,
  getAdminRequests,
  getAdminSetup,
  updateAccessRequest,
} from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin approvals — RollCall" },
      { name: "description", content: "Review and manage attendance session creator access." },
      { property: "og:title", content: "Admin approvals — RollCall" },
      { property: "og:description", content: "Review and manage attendance session creator access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

type RequestRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

function AdminDashboard() {
  const navigate = useNavigate();
  const runSetup = useServerFn(getAdminSetup);
  const runBootstrap = useServerFn(bootstrapAdmin);
  const runRequests = useServerFn(getAdminRequests);
  const runUpdate = useServerFn(updateAccessRequest);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setNotice(null);
    try {
      const setup = await runSetup();
      setSetupAvailable(!setup.hasAdmin);
      if (setup.hasAdmin) {
        const result = await runRequests();
        setRequests((result.requests as RequestRow[]) ?? []);
        setIsAdmin(true);
      }
    } catch (error) {
      setIsAdmin(false);
      if (setupAvailable) setNotice(error instanceof Error ? error.message : "Could not load admin access");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function claimAdmin() {
    setBusyId("bootstrap");
    setNotice(null);
    try {
      await runBootstrap();
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not activate admin access");
    } finally {
      setBusyId(null);
    }
  }

  async function review(requestId: string, decision: "approved" | "rejected" | "revoked") {
    setBusyId(requestId);
    setNotice(null);
    try {
      await runUpdate({ data: { requestId, decision } });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the request");
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></main>;
  }

  if (!isAdmin && setupAvailable) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-12">
        <section className="panel w-full p-6 sm:p-8">
          <ShieldAlert className="size-8 text-accent" />
          <h1 className="mt-4 text-2xl font-bold">Set up the administrator</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is the one-time setup for the existing signed-in account. Once claimed, only this administrator can approve or revoke creator access.
          </p>
          <button
            onClick={() => void claimAdmin()}
            disabled={busyId === "bootstrap"}
            className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busyId === "bootstrap" && <Loader2 className="size-4 animate-spin" />}
            Claim administrator access
          </button>
          {notice && <p className="mt-4 text-sm text-destructive">{notice}</p>}
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-md px-5 py-24 text-center">
        <ShieldAlert className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Administrator access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">This account is not authorized to view approvals.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Back home</Link>
      </main>
    );
  }

  const pending = requests.filter((request) => request.status === "pending");
  const approved = requests.filter((request) => request.status === "approved");
  const reviewed = requests.filter((request) => request.status !== "pending" && request.status !== "approved");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Administrator</p>
          <h1 className="mt-1 text-3xl font-bold">Creator approvals</h1>
          <p className="mt-2 text-sm text-muted-foreground">Approve people who can create new attendance sessions.</p>
        </div>
        <button onClick={() => void signOut()} className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium">
          <LogOut className="size-4" /> Sign out
        </button>
      </header>

      {notice && <p className="mt-5 text-sm text-destructive">{notice}</p>}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-accent" /><h2 className="text-xl font-semibold">Pending access requests</h2></div>
        <RequestList requests={pending} busyId={busyId} onReview={review} empty="No pending requests." />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Approved creators</h2>
        <RequestList requests={approved} busyId={busyId} onReview={review} empty="No approved creators yet." />
      </section>

      {reviewed.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Decision history</h2>
          <RequestList requests={reviewed} busyId={busyId} onReview={review} empty="No reviewed requests." />
        </section>
      )}
    </main>
  );
}

function RequestList({
  requests,
  busyId,
  onReview,
  empty,
}: {
  requests: RequestRow[];
  busyId: string | null;
  onReview: (id: string, decision: "approved" | "rejected" | "revoked") => void;
  empty: string;
}) {
  if (requests.length === 0) return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {requests.map((request) => (
        <div key={request.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4 last:border-b-0">
          <div>
            <p className="font-medium">{request.name}</p>
            <p className="text-sm text-muted-foreground">{request.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">Requested {new Date(request.created_at).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {request.status !== "approved" && request.status !== "revoked" && (
              <button disabled={busyId === request.id} onClick={() => onReview(request.id, "approved")} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Check className="size-4" /> Approve</button>
            )}
            {request.status === "approved" ? (
              <button disabled={busyId === request.id} onClick={() => onReview(request.id, "revoked")} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-60"><X className="size-4" /> Revoke</button>
            ) : request.status === "pending" ? (
              <button disabled={busyId === request.id} onClick={() => onReview(request.id, "rejected")} className="flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium disabled:opacity-60"><X className="size-4" /> Reject</button>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">{request.status}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}