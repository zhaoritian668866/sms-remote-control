import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDeviceById: vi.fn(),
    getUserById: vi.fn(),
    searchChatContacts: vi.fn(),
  };
});

import { getDeviceById, getUserById, searchChatContacts } from "./db";

const mockedGetDeviceById = vi.mocked(getDeviceById);
const mockedGetUserById = vi.mocked(getUserById);
const mockedSearchChatContacts = vi.mocked(searchChatContacts);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, groupId: number | null = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "password",
    role: role as any,
    groupId: groupId as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("chatRecords.searchContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results for superadmin", async () => {
    const ctx = createContext("superadmin");
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2,
      name: "Test Device",
      phoneNumber: "13800138000",
      platform: "android",
      appVersion: "2.3.0",
      isOnline: true,
      lastSeen: new Date(),
      createdAt: new Date(),
    } as any);

    mockedSearchChatContacts.mockResolvedValue([
      {
        phoneNumber: "13900139000",
        contactName: "张三",
        lastMessage: "你好，这是测试消息",
        lastTime: Date.now(),
        totalMessages: 5,
        incomingCount: 3,
        outgoingCount: 2,
        hasReplied: true,
      },
    ]);

    const result = await caller.chatRecords.searchContacts({
      deviceId: 1,
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      keyword: "测试",
    });

    expect(result).toHaveLength(1);
    expect(result[0].phoneNumber).toBe("13900139000");
    expect(result[0].contactName).toBe("张三");
    expect(mockedSearchChatContacts).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number), "测试");
  });

  it("returns search results for auditor", async () => {
    const ctx = createContext("auditor");
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2,
      name: "Test Device",
    } as any);

    mockedSearchChatContacts.mockResolvedValue([]);

    const result = await caller.chatRecords.searchContacts({
      deviceId: 1,
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      keyword: "hello",
    });

    expect(result).toHaveLength(0);
    expect(mockedSearchChatContacts).toHaveBeenCalled();
  });

  it("returns search results for admin within their group", async () => {
    const ctx = createContext("admin", 1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2,
      name: "Test Device",
    } as any);

    mockedGetUserById.mockResolvedValue({
      id: 2,
      groupId: 1,
      name: "Device Owner",
    } as any);

    mockedSearchChatContacts.mockResolvedValue([
      {
        phoneNumber: "13800138001",
        contactName: "李四",
        lastMessage: "搜索到的消息",
        lastTime: Date.now(),
        totalMessages: 2,
        incomingCount: 1,
        outgoingCount: 1,
        hasReplied: true,
      },
    ]);

    const result = await caller.chatRecords.searchContacts({
      deviceId: 1,
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      keyword: "搜索",
    });

    expect(result).toHaveLength(1);
    expect(result[0].phoneNumber).toBe("13800138001");
  });

  it("rejects access for regular user", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.chatRecords.searchContacts({
        deviceId: 1,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        keyword: "test",
      })
    ).rejects.toThrow();
  });

  it("rejects admin accessing device outside their group", async () => {
    const ctx = createContext("admin", 1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2,
      name: "Test Device",
    } as any);

    mockedGetUserById.mockResolvedValue({
      id: 2,
      groupId: 2, // Different group
      name: "Device Owner",
    } as any);

    await expect(
      caller.chatRecords.searchContacts({
        deviceId: 1,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        keyword: "test",
      })
    ).rejects.toThrow("无权访问该设备");
  });

  it("rejects when device does not exist", async () => {
    const ctx = createContext("superadmin");
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue(undefined as any);

    await expect(
      caller.chatRecords.searchContacts({
        deviceId: 999,
        startTime: Date.now() - 86400000,
        endTime: Date.now(),
        keyword: "test",
      })
    ).rejects.toThrow("设备不存在");
  });
});
