import { createServerFn } from "@tanstack/react-start";

function text(value: unknown, max: number) {
  if (typeof value !== "string") throw new Error("Invalid input");
  const result = value.trim();
  if (!result || result.length > max) throw new Error("Please check the entered details");
  return result;
}

function creatorPassword(value: unknown) {
  const result = text(value, 200);
  if (result.length < 8) throw new Error("Password must be at least 8 characters");
  return result;
}

function email(value: unknown) {
  const result = text(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error("Enter a valid email address");
  return result;
}

export const requestAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; password: string }) => ({
    name: text(data?.name, 120),
    email: email(data?.email),
    password: creatorPassword(data?.password),
  }))
  .handler(async ({ data }) => {
    const { requestCreatorAccess } = await import("./access.server");
    return requestCreatorAccess(data.name, data.email, data.password);
  });

export const getCreatorAccessState = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getCreatorSessionState } = await import("./access.server");
    return getCreatorSessionState();
  });

export const creatorLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({
    email: email(data?.email),
    password: creatorPassword(data?.password),
  }))
  .handler(async ({ data }) => {
    const { creatorLogin: login } = await import("./access.server");
    return login(data.email, data.password);
  });

export const creatorLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { creatorLogout: logout } = await import("./access.server");
  return logout();
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