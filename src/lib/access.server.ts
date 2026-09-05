import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";

type AccessDecision = "approved" | "rejected" | "revoked";
type AdminSession = { isAdmin?: boolean };

function adminSessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Admin session is not configured");
  return {
    password,
    name: "rollcall-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function passwordMatches(input: string, expected: string) {
  const inputHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export async function adminLogin(password: string) {
  const expected = process.env["SITE_PASSWORD"];
  if (!expected) throw new Error("Admin login is not configured");
  if (!passwordMatches(password, expected)) return { ok: false as const };

  const session = await useSession<AdminSession>(adminSessionConfig());
  await session.update({ isAdmin: true });
  return { ok: true as const };
}

export async function getAdminSessionState() {
  const session = await useSession<AdminSession>(adminSessionConfig());
  return { isAdmin: Boolean(session.data.isAdmin) };
}

export async function requireAdminSession() {
  const session = await useSession<AdminSession>(adminSessionConfig());
  if (!session.data.isAdmin) throw new Error("Administrator login required");
  return session;
}

export async function adminLogout() {
  const session = await useSession<AdminSession>(adminSessionConfig());
  await session.clear();
  return { ok: true as const };
}

async function getAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isAdmin(userId: string): Promise<boolean> {
  const db = await getAdminDb();
  const { data } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export async function getUserEmail(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) throw new Error("Your account does not have an email address");
  return data.user.email.trim().toLowerCase();
}

export async function requestCreatorAccess(name: string, email: string) {
  const db = await getAdminDb();
  const { error } = await db.from("access_requests").insert({
    name,
    email: email.toLowerCase(),
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") throw new Error("An access request for this email is already pending.");
    throw new Error("Could not send the access request");
  }
  return { ok: true };
}

export async function getCreatorAccess(userId: string, email: string) {
  if (await isAdmin(userId)) return { status: "approved" as const, isAdmin: true };
  const db = await getAdminDb();
  const { data } = await db
    .from("access_requests")
    .select("status")
    .eq("email", email)
    .in("status", ["approved", "rejected", "revoked"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    status: (data?.status ?? "pending") as "approved" | "rejected" | "revoked" | "pending",
    isAdmin: false,
  };
}

export async function getCreatorAccessForEmail(email: string) {
  const db = await getAdminDb();
  const { data } = await db
    .from("access_requests")
    .select("status")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: (data?.status ?? "pending") as "approved" | "rejected" | "revoked" | "pending",
  };
}

export async function requireSessionCreator(userId: string, email: string) {
  if (await isAdmin(userId)) return;
  const db = await getAdminDb();
  const { data } = await db
    .from("access_requests")
    .select("id")
    .eq("email", email)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) throw new Error("Your session-creator access has not been approved.");
}

export async function bootstrapInitialAdmin(userId: string) {
  const db = await getAdminDb();
  const { count, error: countError } = await db
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (countError) throw new Error("Could not verify administrator setup");
  if ((count ?? 0) > 0) throw new Error("An administrator is already configured.");

  const { error } = await db.from("user_roles").insert({ user_id: userId, role: "admin" });
  if (error) throw new Error("Could not activate administrator access");
  return { ok: true };
}

export async function getAdminSetupState() {
  const db = await getAdminDb();
  const { count, error } = await db
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error("Could not verify administrator setup");
  return { hasAdmin: (count ?? 0) > 0 };
}

export async function getAdminDashboard(userId: string) {
  if (!(await isAdmin(userId))) throw new Error("Administrator access required");
  const db = await getAdminDb();
  const { data, error } = await db
    .from("access_requests")
    .select("id,name,email,status,created_at,reviewed_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load access requests");
  return { requests: data ?? [] };
}

export async function getAdminDashboardWithPassword() {
  await requireAdminSession();
  const db = await getAdminDb();
  const { data, error } = await db
    .from("access_requests")
    .select("id,name,email,status,created_at,reviewed_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load access requests");
  return { requests: data ?? [] };
}

export async function reviewCreatorAccess(userId: string, requestId: string, decision: AccessDecision) {
  if (!(await isAdmin(userId))) throw new Error("Administrator access required");
  const db = await getAdminDb();
  const { error } = await db
    .from("access_requests")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", requestId);
  if (error) throw new Error("Could not update this access request");
  return { ok: true };
}

export async function reviewCreatorAccessWithPassword(requestId: string, decision: AccessDecision) {
  await requireAdminSession();
  const db = await getAdminDb();
  const { error } = await db
    .from("access_requests")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: null,
    })
    .eq("id", requestId);
  if (error) throw new Error("Could not update this access request");
  return { ok: true };
}