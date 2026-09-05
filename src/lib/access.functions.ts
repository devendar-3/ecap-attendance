import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function text(value: unknown, max: number) {
  if (typeof value !== "string") throw new Error("Invalid input");
  const result = value.trim();
  if (!result || result.length > max) throw new Error("Please check the entered details");
  return result;
}

function email(value: unknown) {
  const result = text(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error("Enter a valid email address");
  return result;
}

export const requestAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string }) => ({
    name: text(data?.name, 120),
    email: email(data?.email),
  }))
  .handler(async ({ data }) => {
    const { requestCreatorAccess } = await import("./access.server");
    return requestCreatorAccess(data.name, data.email);
  });

export const getCreatorAccessState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCreatorAccess, getUserEmail } = await import("./access.server");
    const userEmail = await getUserEmail(context.supabase);
    return getCreatorAccess(context.userId, userEmail);
  });

export const checkCreatorEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => ({ email: email(data?.email) }))
  .handler(async ({ data }) => {
    const { getCreatorAccessForEmail } = await import("./access.server");
    return getCreatorAccessForEmail(data.email);
  });

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { bootstrapInitialAdmin } = await import("./access.server");
    return bootstrapInitialAdmin(context.userId);
  });

export const getAdminSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminSessionState } = await import("./access.server");
  return getAdminSessionState();
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => ({ password: text(data?.password, 200) }))
  .handler(async ({ data }) => {
    const { adminLogin: login } = await import("./access.server");
    return login(data.password);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { adminLogout: logout } = await import("./access.server");
  return logout();
});

export const getAdminRequests = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminDashboardWithPassword } = await import("./access.server");
  return getAdminDashboardWithPassword();
});

export const updateAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((data: { requestId: string; decision: "approved" | "rejected" | "revoked" }) => {
    const requestId = text(data?.requestId, 64);
    if (!["approved", "rejected", "revoked"].includes(data?.decision)) throw new Error("Invalid decision");
    return { requestId, decision: data.decision };
  })
  .handler(async ({ data }) => {
    const { reviewCreatorAccessWithPassword } = await import("./access.server");
    return reviewCreatorAccessWithPassword(data.requestId, data.decision);
  });