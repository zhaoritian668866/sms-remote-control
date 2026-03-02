import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    username: "testuser",
    passwordHash: null,
    loginMethod: "password",
    role: "admin",
    groupId: 1,
    maxDevices: 30,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {
        origin: "https://test.example.com",
        referer: "https://test.example.com/",
      },
      get: (name: string) => "test.example.com",
    } as any,
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      get: () => "test.example.com",
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user-001");
    expect(result?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("device.list", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.device.list()).rejects.toThrow();
  });

  it("returns device list for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.device.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("device.get", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.device.get({ id: 1 })).rejects.toThrow();
  });

  it("returns null for non-existent device", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.device.get({ id: 99999 });
    expect(result).toBeNull();
  });
});

describe("pairing.generate", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.pairing.generate()).rejects.toThrow();
  });

  it("generates QR code with token for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pairing.generate();
    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("qrDataUrl");
    expect(result).toHaveProperty("expiresAt");
    expect(result).toHaveProperty("pairingPayload");
    expect(result.token.length).toBe(32);
    expect(result.qrDataUrl).toContain("data:image/png;base64");
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.pairingPayload).toContain(result.token);
  });
});

describe("sms.list", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.sms.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });

  it("returns message list for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sms.list({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("sms.send", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sms.send({ deviceId: 1, phoneNumber: "13800138000", body: "test" })
    ).rejects.toThrow();
  });

  it("rejects send to non-existent device", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sms.send({ deviceId: 99999, phoneNumber: "13800138000", body: "test" })
    ).rejects.toThrow("设备不存在");
  });
});

describe("device.rename", () => {
  it("validates name length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.device.rename({ id: 1, name: "" })
    ).rejects.toThrow();
  });

  it("rejects rename for non-existent device", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.device.rename({ id: 99999, name: "New Name" })
    ).rejects.toThrow("设备不存在");
  });
});

describe("device.remove", () => {
  it("rejects remove for non-existent device", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.device.remove({ id: 99999 })
    ).rejects.toThrow("设备不存在");
  });
});
