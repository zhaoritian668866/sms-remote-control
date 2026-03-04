import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDeviceById: vi.fn(),
    getPinnedContacts: vi.fn(),
    pinContact: vi.fn(),
    unpinContact: vi.fn(),
  };
});

import { getDeviceById, getPinnedContacts, pinContact, unpinContact } from "./db";

const mockGetDeviceById = vi.mocked(getDeviceById);
const mockGetPinnedContacts = vi.mocked(getPinnedContacts);
const mockPinContact = vi.mocked(pinContact);
const mockUnpinContact = vi.mocked(unpinContact);

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

describe("pinned.list", () => {
  it("returns pinned contacts for a device owned by the user", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 1,
      name: "Test Phone",
      deviceId: "abc123",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    const pinnedData = [
      { id: 1, deviceId: 10, phoneNumber: "13900139000", pinnedAt: new Date() },
      { id: 2, deviceId: 10, phoneNumber: "13700137000", pinnedAt: new Date() },
    ];
    mockGetPinnedContacts.mockResolvedValue(pinnedData);

    const result = await caller.pinned.list({ deviceId: 10 });
    expect(result).toEqual(pinnedData);
    expect(mockGetPinnedContacts).toHaveBeenCalledWith(10);
  });

  it("returns empty array if device does not belong to user", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 999, // different user
      name: "Other Phone",
      deviceId: "xyz",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    const result = await caller.pinned.list({ deviceId: 10 });
    expect(result).toEqual([]);
    expect(mockGetPinnedContacts).not.toHaveBeenCalled();
  });

  it("returns empty array if device does not exist", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue(undefined);

    const result = await caller.pinned.list({ deviceId: 999 });
    expect(result).toEqual([]);
  });
});

describe("pinned.pin", () => {
  it("pins a contact successfully", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 1,
      name: "Test Phone",
      deviceId: "abc123",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    const pinnedResult = { id: 1, deviceId: 10, phoneNumber: "13900139000", pinnedAt: new Date() };
    mockPinContact.mockResolvedValue(pinnedResult);

    const result = await caller.pinned.pin({ deviceId: 10, phoneNumber: "13900139000" });
    expect(result).toEqual(pinnedResult);
    expect(mockPinContact).toHaveBeenCalledWith(10, "13900139000");
  });

  it("normalizes phone number with +86 prefix", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 1,
      name: "Test Phone",
      deviceId: "abc123",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    const pinnedResult = { id: 1, deviceId: 10, phoneNumber: "13900139000", pinnedAt: new Date() };
    mockPinContact.mockResolvedValue(pinnedResult);

    await caller.pinned.pin({ deviceId: 10, phoneNumber: "+8613900139000" });
    expect(mockPinContact).toHaveBeenCalledWith(10, "13900139000");
  });

  it("throws error if device does not belong to user", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 999,
      name: "Other Phone",
      deviceId: "xyz",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    await expect(caller.pinned.pin({ deviceId: 10, phoneNumber: "13900139000" }))
      .rejects.toThrow("设备不存在");
  });
});

describe("pinned.unpin", () => {
  it("unpins a contact successfully", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 1,
      name: "Test Phone",
      deviceId: "abc123",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    mockUnpinContact.mockResolvedValue(undefined);

    const result = await caller.pinned.unpin({ deviceId: 10, phoneNumber: "13900139000" });
    expect(result).toEqual({ success: true });
    expect(mockUnpinContact).toHaveBeenCalledWith(10, "13900139000");
  });

  it("throws error if device does not belong to user", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 999,
      name: "Other Phone",
      deviceId: "xyz",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    await expect(caller.pinned.unpin({ deviceId: 10, phoneNumber: "13900139000" }))
      .rejects.toThrow("设备不存在");
  });

  it("normalizes phone number with +86 prefix on unpin", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    mockGetDeviceById.mockResolvedValue({
      id: 10,
      userId: 1,
      name: "Test Phone",
      deviceId: "abc123",
      phoneNumber: "13800138000",
      isOnline: true,
      batteryLevel: 80,
      signalStrength: 90,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      model: "Pixel",
      pairingToken: "tok",
    } as any);

    mockUnpinContact.mockResolvedValue(undefined);

    await caller.pinned.unpin({ deviceId: 10, phoneNumber: "+8613900139000" });
    expect(mockUnpinContact).toHaveBeenCalledWith(10, "13900139000");
  });
});
