import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDeviceById: vi.fn(),
    getReadStatusByDeviceId: vi.fn(),
    markContactAsRead: vi.fn(),
    batchMarkContactsAsRead: vi.fn(),
  };
});

import { getDeviceById, getReadStatusByDeviceId, markContactAsRead, batchMarkContactsAsRead } from "./db";

const mockedGetDeviceById = vi.mocked(getDeviceById);
const mockedGetReadStatus = vi.mocked(getReadStatusByDeviceId);
const mockedMarkRead = vi.mocked(markContactAsRead);
const mockedBatchMarkRead = vi.mocked(batchMarkContactsAsRead);

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "password",
    role: "user",
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

describe("sms.readStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns read timestamps for own device", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 1,
      name: "Test Device",
    } as any);

    mockedGetReadStatus.mockResolvedValue({
      "13800138000": 1710000000000,
      "13900139000": 1710000001000,
    });

    const result = await caller.sms.readStatus({ deviceId: 1 });

    expect(result).toEqual({
      "13800138000": 1710000000000,
      "13900139000": 1710000001000,
    });
    expect(mockedGetReadStatus).toHaveBeenCalledWith(1);
  });

  it("returns empty for device not owned by user", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2, // Different user
      name: "Test Device",
    } as any);

    const result = await caller.sms.readStatus({ deviceId: 1 });
    expect(result).toEqual({});
  });
});

describe("sms.markRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a contact as read for own device", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 1,
      name: "Test Device",
    } as any);

    mockedMarkRead.mockResolvedValue(undefined);

    const result = await caller.sms.markRead({
      deviceId: 1,
      phoneNumber: "13800138000",
      lastReadAt: Date.now(),
    });

    expect(result).toEqual({ success: true });
    expect(mockedMarkRead).toHaveBeenCalledWith(1, "13800138000", expect.any(Number));
  });

  it("rejects marking read for device not owned by user", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2, // Different user
      name: "Test Device",
    } as any);

    await expect(
      caller.sms.markRead({
        deviceId: 1,
        phoneNumber: "13800138000",
        lastReadAt: Date.now(),
      })
    ).rejects.toThrow("无权操作");
  });
});

describe("sms.batchMarkRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("batch marks contacts as read for own device", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 1,
      name: "Test Device",
    } as any);

    mockedBatchMarkRead.mockResolvedValue(undefined);

    const entries = [
      { phoneNumber: "13800138000", lastReadAt: 1710000000000 },
      { phoneNumber: "13900139000", lastReadAt: 1710000001000 },
    ];

    const result = await caller.sms.batchMarkRead({
      deviceId: 1,
      entries,
    });

    expect(result).toEqual({ success: true });
    expect(mockedBatchMarkRead).toHaveBeenCalledWith(1, entries);
  });

  it("rejects batch mark for device not owned by user", async () => {
    const ctx = createContext(1);
    const caller = appRouter.createCaller(ctx);

    mockedGetDeviceById.mockResolvedValue({
      id: 1,
      deviceId: "device-1",
      userId: 2,
      name: "Test Device",
    } as any);

    await expect(
      caller.sms.batchMarkRead({
        deviceId: 1,
        entries: [{ phoneNumber: "13800138000", lastReadAt: 1710000000000 }],
      })
    ).rejects.toThrow("无权操作");
  });
});
