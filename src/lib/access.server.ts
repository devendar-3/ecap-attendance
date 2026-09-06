import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";

type AccessDecision = "approved" | "rejected" | "revoked";
type AdminSession = { isAdmin?: boolean };
type CreatorSession = { email?: string };

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

function creatorSessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Creator session is not configured");
  return {
    password,
    name: "rollcall-creator",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function passwordMatches(input: string, expected: string) {
  const inputHash = createHash("sha256").update(input, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(inputHash, expectedHash);
}

function hashCreatorPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`, "utf8").digest("hex");
}

function creatorPasswordMatches(password: string, salt: string, expected: string) {
  const actual = Buffer.from(hashCreatorPassword(password, salt), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
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

export async function requestCreatorAccess(name: string, email: string, password: string) {
  const db = await getAdminDb();
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = hashCreatorPassword(password, passwordSalt);
  const { error } = await db.from("access_requests").insert({
    name,
    email: email.toLowerCase(),
    status: "pending",
    password_hash: passwordHash,
    password_salt: passwordSalt,
  });
  if (error) {
    if (error.code === "23505") {
      const { error: updateError } = await db
        .from("access_requests")
        .update({
          name,
          password_hash: passwordHash,
          password_salt: passwordSalt,
        })
        .eq("email", email.toLowerCase())
        .eq("status", "pending");
      if (!updateError) return { ok: true };
      throw new Error("An access request for this email is already pending.");
    }
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

export async function creatorLogin(email: string, password: string) {
  const db = await getAdminDb();
  const { data } = await db
    .from("access_requests")
    .select("status,password_hash,password_salt")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .maybeSingle();
  if (!data || data.status !== "approved") {
    throw new Error(
      data?.status === "pending"
        ? "Your creator access request is still awaiting administrator approval."
        : data?.status === "revoked"
          ? "Your creator access has been revoked."
          : "This email is not approved to create sessions.",
    );
  }
  if (!data.password_hash || !data.password_salt || !creatorPasswordMatches(password, data.password_salt, data.password_hash)) {
    throw new Error("The email or password is incorrect.");
  }

  const session = await useSession<CreatorSession>(creatorSessionConfig());
  await session.update({ email });
  return { ok: true as const };
}

export async function getCreatorSessionState() {
  const session = await useSession<CreatorSession>(creatorSessionConfig());
  if (!session.data.email) return { signedIn: false as const, status: null };
  const access = await getCreatorAccessForEmail(session.data.email);
  if (access.status !== "approved") {
    await session.clear();
    return { signedIn: false as const, status: access.status };
  }
  return { signedIn: true as const, status: "approved" as const, email: session.data.email };
}

export async function creatorLogout() {
  const session = await useSession<CreatorSession>(creatorSessionConfig());
  await session.clear();
  return { ok: true as const };
}

export async function requireSessionCreator() {
  const session = await useSession<CreatorSession>(creatorSessionConfig());
  if (!session.data.email) throw new Error("Please sign in before creating a session.");
  const db = await getAdminDb();
  const { data } = await db
    .from("access_requests")
    .select("id")
    .eq("email", session.data.email)
    .eq("status", "approved")
    .maybeSingle();
  if (!data) {
    await session.clear();
    throw new Error("Your session-creator access has not been approved.");
  }
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