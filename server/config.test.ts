import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createBaseUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-001",
    username: "testuser",
    passwordHash: "hashed",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "password",
    role: "user",
    groupId: 1,
    maxDevices: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createCtx(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {
        origin: "https://test.example.com",
        referer: "https://test.example.com/",
      },
      get: () => "test.example.com",
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

// ─── Three-level Permission Tests ───

describe("superadmin procedures", () => {
  it("should reject unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.superadmin.stats()).rejects.toThrow();
  });

  it("should reject regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.superadmin.stats()).rejects.toThrow();
  });

  it("should reject admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.superadmin.stats()).rejects.toThrow();
  });
});

describe("admin procedures", () => {
  it("should reject unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("should reject regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("should allow admin users", async () => {
    const user = createBaseUser({ role: "admin", groupId: 1 });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      await caller.admin.stats();
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── Public Config API Tests ───

describe("config.getServiceLink", () => {
  it("returns service link (public, no auth required)", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    const result = await caller.config.getServiceLink();
    expect(result).toHaveProperty("link");
    expect(typeof result.link).toBe("string");
  });

  it("returns service link for authenticated user", async () => {
    const user = createBaseUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.config.getServiceLink();
    expect(result).toHaveProperty("link");
  });
});

// ─── Admin Config Management Tests ───

describe("superadmin.getConfigs", () => {
  it("requires superadmin role", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "user" })));
    await expect(caller.superadmin.getConfigs()).rejects.toThrow();
  });

  it("rejects admin role (not superadmin)", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "admin" })));
    await expect(caller.superadmin.getConfigs()).rejects.toThrow();
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.superadmin.getConfigs()).rejects.toThrow();
  });

  it("returns config list for superadmin", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "superadmin" })));
    const result = await caller.superadmin.getConfigs();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("superadmin.setConfig", () => {
  it("requires superadmin role", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "user" })));
    await expect(
      caller.superadmin.setConfig({ key: "customer_service_link", value: "https://example.com/support" })
    ).rejects.toThrow();
  });

  it("saves config for superadmin", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "superadmin" })));
    const result = await caller.superadmin.setConfig({
      key: "customer_service_link",
      value: "https://example.com/support",
      description: "Test customer service link",
    });
    expect(result).toEqual({ success: true });
  });

  it("validates key is not empty", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "superadmin" })));
    await expect(
      caller.superadmin.setConfig({ key: "", value: "test" })
    ).rejects.toThrow();
  });

  it("persists config value and can be read back", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "superadmin" })));
    await caller.superadmin.setConfig({
      key: "test_config_key",
      value: "test_config_value",
      description: "Test config",
    });
    const configs = await caller.superadmin.getConfigs();
    const testConfig = configs.find((c: any) => c.configKey === "test_config_key");
    expect(testConfig).toBeDefined();
    expect(testConfig?.configValue).toBe("test_config_value");
  });
});

// ─── Admin Stats Tests ───

describe("admin.stats", () => {
  it("requires admin role", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "user" })));
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("returns stats for admin", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "admin" })));
    const result = await caller.admin.stats();
    expect(result).toHaveProperty("totalUsers");
    expect(result).toHaveProperty("totalDevices");
    expect(result).toHaveProperty("onlineDevices");
    expect(result).toHaveProperty("totalMessages");
    expect(typeof result.totalUsers).toBe("number");
    expect(typeof result.totalDevices).toBe("number");
  });
});

// ─── Admin User Management Tests ───

describe("admin.users", () => {
  it("requires admin role", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "user" })));
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("returns user list for admin", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "admin" })));
    const result = await caller.admin.users();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.updateUser", () => {
  it("requires admin role", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "user" })));
    await expect(
      caller.admin.updateUser({ id: 1, maxDevices: 10 })
    ).rejects.toThrow();
  });

  it("validates maxDevices range", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ role: "admin" })));
    await expect(
      caller.admin.updateUser({ id: 1, maxDevices: -1 })
    ).rejects.toThrow();
    await expect(
      caller.admin.updateUser({ id: 1, maxDevices: 1000 })
    ).rejects.toThrow();
  });
});

// ─── Device Quota Tests ───

describe("device.quota", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.device.quota()).rejects.toThrow();
  });

  it("returns quota info for authenticated user", async () => {
    const caller = appRouter.createCaller(createCtx(createBaseUser({ maxDevices: 3 })));
    const result = await caller.device.quota();
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("max");
    expect(typeof result.current).toBe("number");
    expect(typeof result.max).toBe("number");
    expect(result.max).toBe(3);
  });
});

// ─── Pairing Token Generation Tests ───

describe("pairing.generate", () => {
  it("always allows generating pairing token (quota check moved to wsManager)", async () => {
    // Quota check now happens during actual pairing in wsManager, not at token generation
    // So pairing.generate should always succeed for authenticated users
    const user = createBaseUser({ maxDevices: 0 });
    const caller = appRouter.createCaller(createCtx(user));
    // Should not throw - token generation is always allowed
    const result = await caller.pairing.generate();
    expect(result).toBeDefined();
    expect(result.token).toBeDefined();
  });
});

// ─── Registration with groupCode ───

describe("auth.register", () => {
  it("should require groupCode for registration", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.auth.register({
        username: "newuser",
        password: "password123",
        name: "New User",
        groupCode: "",
      })
    ).rejects.toThrow();
  });
});

// ─── SMS Export ───

describe("sms.exportNumbers", () => {
  it("should reject unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.sms.exportNumbers({})).rejects.toThrow();
  });

  it("should allow authenticated users to export", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.sms.exportNumbers({});
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── Auth.me ───

describe("auth.me", () => {
  it("returns null for unauthenticated", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user info for authenticated", async () => {
    const user = createBaseUser();
    const caller = appRouter.createCaller(createCtx(user));
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(user.id);
    expect(result?.role).toBe("user");
  });
});
