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
  };
});

import { getDeviceStats } from "./db";

const mockGetDeviceStats = vi.mocked(getDeviceStats);

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    username: "testuser",
    passwordHash: null,
    loginMethod: "password",
    role: "user",
    groupId: 1,
    maxDevices: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stats.devices", () => {
  it("returns device stats for authenticated user", async () => {
    const { ctx } = createAuthContext(1);
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
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceStats.mockResolvedValue([]);

    const startTime = new Date("2026-03-01").getTime();
    const endTime = new Date("2026-03-04").getTime();

    await caller.stats.devices({ startTime, endTime });
    expect(mockGetDeviceStats).toHaveBeenCalledWith(1, {
      startTime,
      endTime,
    });
  });

  it("returns empty array when no devices", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceStats.mockResolvedValue([]);

    const result = await caller.stats.devices({});
    expect(result).toEqual([]);
  });

  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: { origin: "https://test.example.com" },
        get: () => "test.example.com",
      } as any,
      res: {
        clearCookie: () => {},
      } as any,
    };

    const caller = appRouter.createCaller(ctx);
    await expect(caller.stats.devices({})).rejects.toThrow();
  });
});
