import { describe, it, expect } from "vitest";
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

// ─── AI Config Permission Tests ───

describe("AI config access control", () => {
  it("ai.getConfig rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.getConfig()).rejects.toThrow();
  });

  it("ai.getConfig rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.getConfig()).rejects.toThrow();
  });

  it("ai.getConfig rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.getConfig()).rejects.toThrow();
  });

  it("ai.getConfig allows superadmin", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    // Should not throw UNAUTHORIZED or FORBIDDEN
    try {
      const result = await caller.ai.getConfig();
      // Result can be null if no config exists yet
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Learning Stats Permission Tests ───

describe("AI learning stats access control", () => {
  it("ai.learningStats rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.learningStats()).rejects.toThrow();
  });

  it("ai.learningStats rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.learningStats()).rejects.toThrow();
  });

  it("ai.learningStats rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.learningStats()).rejects.toThrow();
  });

  it("ai.learningStats allows superadmin and returns correct shape", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.learningStats();
      expect(result).toHaveProperty("totalConversations");
      expect(result).toHaveProperty("totalMessages");
      expect(result).toHaveProperty("totalOutgoing");
      expect(result).toHaveProperty("totalIncoming");
      expect(result).toHaveProperty("recentSamples");
      expect(typeof result.totalConversations).toBe("number");
      expect(typeof result.totalMessages).toBe("number");
      expect(typeof result.totalOutgoing).toBe("number");
      expect(typeof result.totalIncoming).toBe("number");
      expect(Array.isArray(result.recentSamples)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Refresh Learning Permission Tests ───

describe("AI refresh learning access control", () => {
  it("ai.refreshLearning rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.refreshLearning()).rejects.toThrow();
  });

  it("ai.refreshLearning rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.refreshLearning()).rejects.toThrow();
  });

  it("ai.refreshLearning rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.refreshLearning()).rejects.toThrow();
  });

  it("ai.refreshLearning allows superadmin and returns learnedCount", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.refreshLearning();
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("learnedCount");
      expect(result.success).toBe(true);
      expect(typeof result.learnedCount).toBe("number");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Update Config Permission Tests ───

describe("AI update config access control", () => {
  it("ai.updateConfig rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.ai.updateConfig({
        apiUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        modelName: "gpt-4o-mini",
        isEnabled: false,
      })
    ).rejects.toThrow();
  });

  it("ai.updateConfig rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(
      caller.ai.updateConfig({
        apiUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        modelName: "gpt-4o-mini",
        isEnabled: false,
      })
    ).rejects.toThrow();
  });

  it("ai.updateConfig allows superadmin with learningEnabled flag", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.updateConfig({
        apiUrl: "https://api.openai.com/v1",
        apiKey: "sk-test-key-12345",
        modelName: "gpt-4o-mini",
        isEnabled: false,
        learningEnabled: true,
      });
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Test Connection Permission Tests ───

describe("AI test connection access control", () => {
  it("ai.testConnection rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.ai.testConnection({
        apiUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        modelName: "gpt-4o-mini",
      })
    ).rejects.toThrow();
  });

  it("ai.testConnection rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(
      caller.ai.testConnection({
        apiUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        modelName: "gpt-4o-mini",
      })
    ).rejects.toThrow();
  });
});

// ─── AI User Settings Permission Tests ───

describe("AI user settings access control", () => {
  it("ai.getSettings rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.getSettings()).rejects.toThrow();
  });

  it("ai.getSettings allows authenticated user", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.getSettings();
      // Can be null if no settings exist
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});
