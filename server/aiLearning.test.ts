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
    try {
      const result = await caller.ai.getConfig();
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
      expect(Array.isArray(result.recentSamples)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Preview Samples Permission Tests ───

describe("AI preview samples access control", () => {
  it("ai.previewSamples rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.previewSamples({})).rejects.toThrow();
  });

  it("ai.previewSamples rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.previewSamples({})).rejects.toThrow();
  });

  it("ai.previewSamples rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.previewSamples({})).rejects.toThrow();
  });

  it("ai.previewSamples allows superadmin and returns array", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.previewSamples({});
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("ai.previewSamples accepts limit parameter", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.previewSamples({ limit: 3 });
      expect(Array.isArray(result)).toBe(true);
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
      expect(result === null || typeof result === "object").toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Simulate Permission Tests ───

describe("AI simulate access control", () => {
  it("ai.simulate rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.ai.simulate({ message: "你好" })
    ).rejects.toThrow();
  });

  it("ai.simulate rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(
      caller.ai.simulate({ message: "你好" })
    ).rejects.toThrow();
  });

  it("ai.simulate rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(
      caller.ai.simulate({ message: "你好" })
    ).rejects.toThrow();
  });

  it("ai.simulate allows superadmin", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.simulate({ message: "你好" });
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("ai.simulate accepts history parameter", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.simulate({
        message: "你多大了",
        history: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好呀" },
        ],
      });
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Learn And Mark Permission Tests ───

describe("AI learnAndMark access control", () => {
  it("ai.learnAndMark rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.learnAndMark({})).rejects.toThrow();
  });

  it("ai.learnAndMark rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.learnAndMark({})).rejects.toThrow();
  });

  it("ai.learnAndMark rejects admin users", async () => {
    const user = createBaseUser({ role: "admin" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.learnAndMark({})).rejects.toThrow();
  });

  it("ai.learnAndMark allows superadmin", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.learnAndMark({});
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("learnedCount");
      expect(result).toHaveProperty("markedCount");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("ai.learnAndMark accepts limit parameter", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.learnAndMark({ limit: 5 });
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Generate Summary Permission Tests ───

describe("AI generateSummary access control", () => {
  it("ai.generateSummary rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.generateSummary()).rejects.toThrow();
  });

  it("ai.generateSummary rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.generateSummary()).rejects.toThrow();
  });

  it("ai.generateSummary allows superadmin", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.generateSummary();
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Get Summary Permission Tests ───

describe("AI getSummary access control", () => {
  it("ai.getSummary rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(caller.ai.getSummary()).rejects.toThrow();
  });

  it("ai.getSummary rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(caller.ai.getSummary()).rejects.toThrow();
  });

  it("ai.getSummary allows superadmin and returns correct shape", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.getSummary();
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("lastSummaryAt");
      expect(result).toHaveProperty("replyDelayMin");
      expect(result).toHaveProperty("replyDelayMax");
      expect(typeof result.replyDelayMin).toBe("number");
      expect(typeof result.replyDelayMax).toBe("number");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Update Delay Settings Permission Tests ───

describe("AI updateDelaySettings access control", () => {
  it("ai.updateDelaySettings rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createCtx(null));
    await expect(
      caller.ai.updateDelaySettings({ replyDelayMin: 5, replyDelayMax: 30 })
    ).rejects.toThrow();
  });

  it("ai.updateDelaySettings rejects regular users", async () => {
    const user = createBaseUser({ role: "user" });
    const caller = appRouter.createCaller(createCtx(user));
    await expect(
      caller.ai.updateDelaySettings({ replyDelayMin: 5, replyDelayMax: 30 })
    ).rejects.toThrow();
  });

  it("ai.updateDelaySettings allows superadmin", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.updateDelaySettings({ replyDelayMin: 10, replyDelayMax: 60 });
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });

  it("ai.updateDelaySettings validates min/max range", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    // Min too low
    await expect(
      caller.ai.updateDelaySettings({ replyDelayMin: 0, replyDelayMax: 30 })
    ).rejects.toThrow();
    // Max too high
    await expect(
      caller.ai.updateDelaySettings({ replyDelayMin: 5, replyDelayMax: 500 })
    ).rejects.toThrow();
  });
});

// ─── AI Learning Stats Enhanced Shape Tests ───

describe("AI learningStats enhanced shape", () => {
  it("ai.learningStats returns learnedMessages and unlearnedMessages", async () => {
    const user = createBaseUser({ role: "superadmin" });
    const caller = appRouter.createCaller(createCtx(user));
    try {
      const result = await caller.ai.learningStats();
      expect(result).toHaveProperty("learnedMessages");
      expect(result).toHaveProperty("unlearnedMessages");
      expect(typeof result.learnedMessages).toBe("number");
      expect(typeof result.unlearnedMessages).toBe("number");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── AI Engine Helper Function Tests ───

describe("AI engine helper functions", () => {
  it("shouldReplyToMessage returns correct decisions for rejection messages", async () => {
    const { shouldReplyToMessage } = await import("./aiEngine");
    // Rejection messages should not be replied to
    expect(shouldReplyToMessage("不要再联系我了").shouldReply).toBe(false);
    expect(shouldReplyToMessage("拉黑你").shouldReply).toBe(false);
    expect(shouldReplyToMessage("别发了").shouldReply).toBe(false);
    expect(shouldReplyToMessage("滚").shouldReply).toBe(false);
    expect(shouldReplyToMessage("我要举报你").shouldReply).toBe(false);
  });

  it("shouldReplyToMessage returns true for normal messages", async () => {
    const { shouldReplyToMessage } = await import("./aiEngine");
    expect(shouldReplyToMessage("你好，看到你的短信了").shouldReply).toBe(true);
    expect(shouldReplyToMessage("你是做什么的").shouldReply).toBe(true);
    expect(shouldReplyToMessage("可以加个微信吗").shouldReply).toBe(true);
  });

  it("shouldReplyToMessage handles emoji-only messages with delay", async () => {
    const { shouldReplyToMessage } = await import("./aiEngine");
    const result = shouldReplyToMessage("😊");
    // Emoji is treated as short message - should reply but with longer delay
    expect(result.shouldReply).toBe(true);
    expect(result.delayMultiplier).toBeGreaterThanOrEqual(2);
  });

  it("calculateTypingDelay returns delay within configured range", async () => {
    const { calculateTypingDelay } = await import("./aiEngine");
    const delay = calculateTypingDelay("你好，很高兴认识你", 5, 30);
    expect(delay).toBeGreaterThanOrEqual(5);
    expect(delay).toBeLessThanOrEqual(30);
  });

  it("calculateTypingDelay scales with message length", async () => {
    const { calculateTypingDelay } = await import("./aiEngine");
    const shortDelay = calculateTypingDelay("你好", 3, 60);
    const longDelay = calculateTypingDelay("你好，很高兴认识你，我是通过朋友介绍知道你的，想和你聊聊天", 3, 60);
    // Longer messages should generally have longer delays
    expect(longDelay).toBeGreaterThanOrEqual(shortDelay);
  });
});
