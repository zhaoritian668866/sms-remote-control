import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-001",
    email: "admin@example.com",
    name: "Admin User",
    username: "admin",
    passwordHash: null,
    loginMethod: "password",
    role: "admin",
    maxDevices: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

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
      clearCookie: () => {},
    } as any,
  };
}

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-001",
    email: "user@example.com",
    name: "Normal User",
    username: "normaluser",
    passwordHash: null,
    loginMethod: "password",
    role: "user",
    maxDevices: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

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
      clearCookie: () => {},
    } as any,
  };
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

// ─── Public Config API Tests ───

describe("config.getServiceLink", () => {
  it("returns service link (public, no auth required)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.config.getServiceLink();
    expect(result).toHaveProperty("link");
    expect(typeof result.link).toBe("string");
  });

  it("returns service link for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.config.getServiceLink();
    expect(result).toHaveProperty("link");
  });
});

// ─── Admin Config Management Tests ───

describe("admin.getConfigs", () => {
  it("requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.getConfigs()).rejects.toThrow();
  });

  it("rejects unauthenticated access", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.getConfigs()).rejects.toThrow();
  });

  it("returns config list for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getConfigs();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.setConfig", () => {
  it("requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.setConfig({
        key: "customer_service_link",
        value: "https://example.com/support",
      })
    ).rejects.toThrow();
  });

  it("saves config for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.setConfig({
      key: "customer_service_link",
      value: "https://example.com/support",
      description: "Test customer service link",
    });

    expect(result).toEqual({ success: true });
  });

  it("validates key is not empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.setConfig({ key: "", value: "test" })
    ).rejects.toThrow();
  });

  it("persists config value and can be read back", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Set a config value
    await caller.admin.setConfig({
      key: "test_config_key",
      value: "test_config_value",
      description: "Test config",
    });

    // Read it back via public API (service link) or admin getConfigs
    const configs = await caller.admin.getConfigs();
    const testConfig = configs.find((c: any) => c.configKey === "test_config_key");
    expect(testConfig).toBeDefined();
    expect(testConfig?.configValue).toBe("test_config_value");
  });

  it("updates existing config value", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Set initial value
    await caller.admin.setConfig({
      key: "update_test_key",
      value: "initial_value",
    });

    // Update value
    await caller.admin.setConfig({
      key: "update_test_key",
      value: "updated_value",
    });

    // Verify updated
    const configs = await caller.admin.getConfigs();
    const config = configs.find((c: any) => c.configKey === "update_test_key");
    expect(config?.configValue).toBe("updated_value");
  });
});

// ─── Admin Stats Tests ───

describe("admin.stats", () => {
  it("requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("returns stats for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

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
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("returns user list for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.users();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.updateUser", () => {
  it("requires admin role", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.updateUser({ id: 1, maxDevices: 10 })
    ).rejects.toThrow();
  });

  it("validates maxDevices range", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

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
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.device.quota()).rejects.toThrow();
  });

  it("returns quota info for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.device.quota();
    expect(result).toHaveProperty("current");
    expect(result).toHaveProperty("max");
    expect(typeof result.current).toBe("number");
    expect(typeof result.max).toBe("number");
    expect(result.max).toBe(1); // default maxDevices for test user
  });
});

// ─── Pairing Quota Exceeded Tests ───

describe("pairing.generate quota check", () => {
  it("throws DEVICE_QUOTA_EXCEEDED when at limit", async () => {
    // Create a user context with maxDevices = 0 to simulate quota exceeded
    const ctx = createUserContext({ maxDevices: 0 });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.pairing.generate()).rejects.toThrow(/DEVICE_QUOTA_EXCEEDED/);
  });
});
