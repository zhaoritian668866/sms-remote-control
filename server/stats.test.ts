import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDeviceStats: vi.fn(),
    getAllDeviceStats: vi.fn(),
  };
});

import { getDeviceStats, getAllDeviceStats } from "./db";

const mockGetDeviceStats = vi.mocked(getDeviceStats);
const mockGetAllDeviceStats = vi.mocked(getAllDeviceStats);

function createContext(role: "user" | "admin" | "superadmin" | "auditor" = "user", userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-${role}-${userId}`,
    email: "test@example.com",
    name: `Test ${role}`,
    username: `test${role}`,
    passwordHash: null,
    loginMethod: "password",
    role,
    groupId: 1,
    maxDevices: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    sessionVersion: 1,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { origin: "https://test.example.com" },
      get: () => "test.example.com",
    } as any,
    res: {
      clearCookie: () => {},
    } as any,
  };

  return { ctx };
}

function createUnauthContext(): { ctx: TrpcContext } {
  return {
    ctx: {
      user: null,
      req: {
        protocol: "https",
        headers: { origin: "https://test.example.com" },
        get: () => "test.example.com",
      } as any,
      res: {
        clearCookie: () => {},
      } as any,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stats.devices (personal)", () => {
  it("returns device stats for authenticated user", async () => {
    const { ctx } = createContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    const statsData = [
      { deviceId: 1, deviceName: "Phone A", totalSent: 100, singleReply: 20, multiReply: 5 },
      { deviceId: 2, deviceName: "Phone B", totalSent: 50, singleReply: 10, multiReply: 3 },
    ];
    mockGetDeviceStats.mockResolvedValue(statsData);

    const result = await caller.stats.devices({});
    expect(result).toEqual(statsData);
    expect(mockGetDeviceStats).toHaveBeenCalledWith(1, {
      startTime: undefined,
      endTime: undefined,
    });
  });

  it("passes date range to getDeviceStats", async () => {
    const { ctx } = createContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceStats.mockResolvedValue([]);

    const startTime = new Date("2026-03-01").getTime();
    const endTime = new Date("2026-03-04").getTime();

    await caller.stats.devices({ startTime, endTime });
    expect(mockGetDeviceStats).toHaveBeenCalledWith(1, { startTime, endTime });
  });

  it("requires authentication", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stats.devices({})).rejects.toThrow();
  });
});

describe("stats.all (global)", () => {
  it("superadmin can access global stats", async () => {
    const { ctx } = createContext("superadmin", 1);
    const caller = appRouter.createCaller(ctx);

    const globalData = [
      { deviceId: 1, deviceName: "Phone A", userName: "User1", userId: 10, totalSent: 100, singleReply: 20, multiReply: 5 },
      { deviceId: 2, deviceName: "Phone B", userName: "User2", userId: 20, totalSent: 50, singleReply: 10, multiReply: 3 },
    ];
    mockGetAllDeviceStats.mockResolvedValue(globalData);

    const result = await caller.stats.all({});
    expect(result).toEqual(globalData);
    expect(mockGetAllDeviceStats).toHaveBeenCalledWith({
      startTime: undefined,
      endTime: undefined,
      groupId: undefined,
    });
  });

  it("auditor can access global stats", async () => {
    const { ctx } = createContext("auditor", 2);
    const caller = appRouter.createCaller(ctx);

    mockGetAllDeviceStats.mockResolvedValue([]);

    const result = await caller.stats.all({});
    expect(result).toEqual([]);
  });

  it("superadmin can filter by groupId", async () => {
    const { ctx } = createContext("superadmin", 1);
    const caller = appRouter.createCaller(ctx);

    mockGetAllDeviceStats.mockResolvedValue([]);

    await caller.stats.all({ groupId: 5 });
    expect(mockGetAllDeviceStats).toHaveBeenCalledWith({
      startTime: undefined,
      endTime: undefined,
      groupId: 5,
    });
  });

  it("regular user cannot access global stats", async () => {
    const { ctx } = createContext("user", 1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.stats.all({})).rejects.toThrow("无权访问全局统计");
  });

  it("admin cannot access global stats", async () => {
    const { ctx } = createContext("admin", 1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.stats.all({})).rejects.toThrow("无权访问全局统计");
  });

  it("unauthenticated user cannot access global stats", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.stats.all({})).rejects.toThrow();
  });
});
