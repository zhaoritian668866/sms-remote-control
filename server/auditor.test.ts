import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = TrpcContext["user"] & {};

function makeCtx(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-auditor",
    name: "审计员",
    email: null,
    loginMethod: "password",
    role: "auditor",
    createdAt: new Date(),
    updatedAt: null,
    lastSignedIn: null,
    username: "shenjiadmin",
    passwordHash: "hashed",
    maxDevices: 0,
    isActive: true,
    groupId: null,
    ...overrides,
  };
  return {
    req: {} as any,
    res: {} as any,
    user,
  };
}

const caller = appRouter.createCaller;

describe("Auditor role access", () => {
  it("auditor can access auditor.stats", async () => {
    const ctx = makeCtx({ role: "auditor" });
    const c = caller(ctx);
    // Should not throw - auditor has access
    const result = await c.auditor.stats();
    expect(result).toBeDefined();
    expect(typeof result.totalUsers).toBe("number");
  });

  it("auditor can access auditor.allUsers", async () => {
    const ctx = makeCtx({ role: "auditor" });
    const c = caller(ctx);
    const result = await c.auditor.allUsers();
    expect(Array.isArray(result)).toBe(true);
  });

  it("auditor can access auditor.groups", async () => {
    const ctx = makeCtx({ role: "auditor" });
    const c = caller(ctx);
    const result = await c.auditor.groups();
    expect(Array.isArray(result)).toBe(true);
  });

  it("auditor can access auditor.messages", async () => {
    const ctx = makeCtx({ role: "auditor" });
    const c = caller(ctx);
    const result = await c.auditor.messages({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("auditor can access auditor.exportNumbers", async () => {
    const ctx = makeCtx({ role: "auditor" });
    const c = caller(ctx);
    const result = await c.auditor.exportNumbers({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("superadmin can also access auditor routes", async () => {
    const ctx = makeCtx({ role: "superadmin" });
    const c = caller(ctx);
    const result = await c.auditor.stats();
    expect(result).toBeDefined();
  });

  it("regular user cannot access auditor routes", async () => {
    const ctx = makeCtx({ role: "user" });
    const c = caller(ctx);
    await expect(c.auditor.stats()).rejects.toThrow();
  });

  it("admin cannot access auditor routes", async () => {
    const ctx = makeCtx({ role: "admin" });
    const c = caller(ctx);
    await expect(c.auditor.stats()).rejects.toThrow();
  });

  it("unauthenticated user cannot access auditor routes", async () => {
    const ctx: TrpcContext = { req: {} as any, res: {} as any, user: null };
    const c = caller(ctx);
    await expect(c.auditor.stats()).rejects.toThrow();
  });
});
