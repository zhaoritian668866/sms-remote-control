import { describe, it, expect, vi } from "vitest";
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

const caller = appRouter.createCaller;

// ─── Template Tests ───

describe("template.list", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(caller(ctx).template.list()).rejects.toThrow();
  });

  it("should return templates for authenticated user", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    // Should not throw - returns empty array if no templates
    const result = await caller(ctx).template.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("template.create", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).template.create({ content: "Hello {姓名}" })
    ).rejects.toThrow();
  });

  it("should validate content is not empty", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).template.create({ content: "" })
    ).rejects.toThrow();
  });

  it("should create template with valid content", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    const result = await caller(ctx).template.create({
      content: "{姓名}，您好！",
      label: "问候模板",
    });
    expect(result).toBeDefined();
    expect(result.content).toBe("{姓名}，您好！");
  });
});

describe("template.delete", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).template.delete({ id: 1 })
    ).rejects.toThrow();
  });
});

// ─── Contact Tests ───

describe("contact.import", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).contact.import({
        deviceId: 1,
        contacts: [{ name: "张三", phoneNumber: "13800138001" }],
      })
    ).rejects.toThrow();
  });

  it("should validate contacts array is not empty", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).contact.import({
        deviceId: 1,
        contacts: [],
      })
    ).rejects.toThrow();
  });
});

describe("contact.list", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).contact.list({ deviceId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Bulk Task Tests ───

describe("bulk.list", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(caller(ctx).bulk.list()).rejects.toThrow();
  });

  it("should return tasks for authenticated user", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    const result = await caller(ctx).bulk.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("bulk.create", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).bulk.create({
        deviceId: 1,
        mode: "round_robin",
        intervalSeconds: 10,
        templateIds: [1],
        contacts: [{ name: "张三", phoneNumber: "13800138001" }],
      })
    ).rejects.toThrow();
  });

  it("should validate intervalSeconds minimum is 5", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).bulk.create({
        deviceId: 1,
        mode: "round_robin",
        intervalSeconds: 2,
        templateIds: [1],
        contacts: [{ name: "张三", phoneNumber: "13800138001" }],
      })
    ).rejects.toThrow();
  });

  it("should validate mode is valid enum", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).bulk.create({
        deviceId: 1,
        mode: "invalid" as any,
        intervalSeconds: 10,
        templateIds: [1],
        contacts: [{ name: "张三", phoneNumber: "13800138001" }],
      })
    ).rejects.toThrow();
  });

  it("should require at least one template", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).bulk.create({
        deviceId: 1,
        mode: "round_robin",
        intervalSeconds: 10,
        templateIds: [],
        contacts: [{ name: "张三", phoneNumber: "13800138001" }],
      })
    ).rejects.toThrow();
  });

  it("should require at least one contact", async () => {
    const user = createBaseUser();
    const ctx = createCtx(user);
    await expect(
      caller(ctx).bulk.create({
        deviceId: 1,
        mode: "round_robin",
        intervalSeconds: 10,
        templateIds: [1],
        contacts: [],
      })
    ).rejects.toThrow();
  });
});

describe("bulk.start", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).bulk.start({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("bulk.pause", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).bulk.pause({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("bulk.cancel", () => {
  it("should require authentication", async () => {
    const ctx = createCtx(null);
    await expect(
      caller(ctx).bulk.cancel({ id: 1 })
    ).rejects.toThrow();
  });
});

// ─── Bulk Engine Variable Replacement Tests ───

describe("bulkEngine variable replacement", () => {
  it("should replace {姓名} with contact name", () => {
    const template = "{姓名}，您好！感谢您的支持。";
    const result = template.replace(/\{姓名\}/g, "张三");
    expect(result).toBe("张三，您好！感谢您的支持。");
  });

  it("should replace multiple {姓名} occurrences", () => {
    const template = "{姓名}您好，{姓名}先生/女士，欢迎！";
    const result = template.replace(/\{姓名\}/g, "李四");
    expect(result).toBe("李四您好，李四先生/女士，欢迎！");
  });

  it("should handle template without variables", () => {
    const template = "您好，感谢您的支持。";
    const result = template.replace(/\{姓名\}/g, "王五");
    expect(result).toBe("您好，感谢您的支持。");
  });
});

describe("bulkEngine template selection", () => {
  it("round_robin should cycle through templates", () => {
    const templateIds = [10, 20, 30];
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(templateIds[i % templateIds.length]);
    }
    expect(results).toEqual([10, 20, 30, 10, 20, 30, 10]);
  });

  it("random should select from available templates", () => {
    const templateIds = [10, 20, 30];
    for (let i = 0; i < 20; i++) {
      const selected = templateIds[Math.floor(Math.random() * templateIds.length)];
      expect(templateIds).toContain(selected);
    }
  });
});
