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

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { bootstrapInitialAdmin } = await import("./access.server");
    return bootstrapInitialAdmin(context.userId);
  });

export const getAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminDashboard } = await import("./access.server");
    return getAdminDashboard(context.userId);
  });

export const updateAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { requestId: string; decision: "approved" | "rejected" | "revoked" }) => {
    const requestId = text(data?.requestId, 64);
    if (!["approved", "rejected", "revoked"].includes(data?.decision)) throw new Error("Invalid decision");
    return { requestId, decision: data.decision };
  })
  .handler(async ({ data, context }) => {
    const { reviewCreatorAccess } = await import("./access.server");
    return reviewCreatorAccess(context.userId, data.requestId, data.decision);
  });