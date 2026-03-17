import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createSuperadminContext(username: string = "xiaoqiadmin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "superadmin-openid",
    username,
    passwordHash: null,
    email: "admin@example.com",
    name: "Super Admin",
    loginMethod: "password",
    role: "superadmin",
    groupId: null,
    maxDevices: 999,
    isActive: true,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createRegularAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "admin-openid",
    username: "otheradmin",
    passwordHash: null,
    email: "other@example.com",
    name: "Other Admin",
    loginMethod: "password",
    role: "superadmin",
    groupId: null,
    maxDevices: 999,
    isActive: true,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 3,
    openId: "user-openid",
    username: "regularuser",
    passwordHash: null,
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "password",
    role: "user",
    groupId: 1,
    maxDevices: 5,
    isActive: true,
    sessionVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("superadmin.onlineDevices", () => {
  it("allows xiaoqiadmin to access onlineDevices", async () => {
    const ctx = createSuperadminContext("xiaoqiadmin");
    const caller = appRouter.createCaller(ctx);
    // Should not throw - returns array (may be empty if no devices in test DB)
    const result = await caller.superadmin.onlineDevices();
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects other superadmins from accessing onlineDevices", async () => {
    const ctx = createRegularAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.superadmin.onlineDevices()).rejects.toThrow("无权访问此功能");
  });

  it("rejects regular users from accessing onlineDevices", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Should throw FORBIDDEN from superadminProcedure middleware
    await expect(caller.superadmin.onlineDevices()).rejects.toThrow();
  });
});

describe("superadmin.kickUser", () => {
  it("rejects other superadmins from kicking users", async () => {
    const ctx = createRegularAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.superadmin.kickUser({ userId: 99 })).rejects.toThrow("无权访问此功能");
  });

  it("rejects regular users from kicking users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.superadmin.kickUser({ userId: 99 })).rejects.toThrow();
  });

  it("throws when trying to kick non-existent user", async () => {
    const ctx = createSuperadminContext("xiaoqiadmin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.superadmin.kickUser({ userId: 999999 })).rejects.toThrow("用户不存在");
  });
});

describe("superadmin.kickAndResetPassword", () => {
  it("rejects other superadmins from kick+reset", async () => {
    const ctx = createRegularAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.superadmin.kickAndResetPassword({ userId: 99, newPassword: "newpass123" })
    ).rejects.toThrow("无权访问此功能");
  });

  it("rejects regular users from kick+reset", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.superadmin.kickAndResetPassword({ userId: 99, newPassword: "newpass123" })
    ).rejects.toThrow();
  });

  it("throws when trying to kick+reset non-existent user", async () => {
    const ctx = createSuperadminContext("xiaoqiadmin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.superadmin.kickAndResetPassword({ userId: 999999, newPassword: "newpass123" })
    ).rejects.toThrow("用户不存在");
  });

  it("rejects passwords shorter than 6 characters", async () => {
    const ctx = createSuperadminContext("xiaoqiadmin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.superadmin.kickAndResetPassword({ userId: 1, newPassword: "abc" })
    ).rejects.toThrow();
  });
});
