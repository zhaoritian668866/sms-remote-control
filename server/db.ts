import { eq, and, desc, like, or, gte, lte, sql, asc, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, devices, pairingTokens, messages, systemConfig, groups, smsTemplates, deviceContacts, bulkTasks, pinnedContacts, type InsertDevice, type InsertPairingToken, type InsertMessage, type InsertGroup, type InsertSmsTemplate, type InsertDeviceContact, type InsertBulkTask } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Auth Queries ───

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(data: { username: string; passwordHash: string; name: string; groupId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `local_${data.username}_${Date.now()}`;
  await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    loginMethod: "password",
    role: "user",
    groupId: data.groupId || null,
    maxDevices: 1,
    isActive: true,
    lastSignedIn: new Date(),
  });
  return getUserByUsername(data.username);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'superadmin';
      updateSet.role = 'superadmin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

/** Increment session version to invalidate all existing sessions for this user */
export async function incrementSessionVersion(id: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
  const result = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, id)).limit(1);
  return result[0]?.sessionVersion ?? 1;
}

// ─── Group Queries ───

export async function createGroup(data: InsertGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(groups).values(data);
  const result = await db.select().from(groups).where(eq(groups.groupCode, data.groupCode)).limit(1);
  return result[0];
}

export async function getGroupById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGroupByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(groups).where(eq(groups.groupCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groups).orderBy(desc(groups.createdAt));
}

export async function updateGroup(id: number, data: Partial<InsertGroup>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groups).set(data).where(eq(groups.id, id));
}

export async function deleteGroup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groups).where(eq(groups.id, id));
}

export async function getGroupDeviceCount(groupId: number) {
  const db = await getDb();
  if (!db) return 0;
  // Count all devices owned by users in this group
  const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, groupId));
  if (groupUsers.length === 0) return 0;
  const userIds = groupUsers.map(u => u.id);
  const result = await db.select({ count: sql<number>`count(*)` }).from(devices)
    .where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  return result[0]?.count ?? 0;
}

export async function getGroupUserCount(groupId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users)
    .where(and(eq(users.groupId, groupId), eq(users.role, "user")));
  return result[0]?.count ?? 0;
}

// ─── Admin: User Management ───

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    groupId: users.groupId,
    maxDevices: users.maxDevices,
    isActive: users.isActive,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByGroupId(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    groupId: users.groupId,
    maxDevices: users.maxDevices,
    isActive: users.isActive,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.groupId, groupId)).orderBy(desc(users.createdAt));
}

export async function updateUserAdmin(id: number, data: { maxDevices?: number; isActive?: boolean; role?: "user" | "admin" | "superadmin"; name?: string; groupId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function getDeviceCountByUserId(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.userId, userId));
  return result[0]?.count ?? 0;
}

export async function getSystemStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalDevices: 0, totalMessages: 0, onlineDevices: 0, totalGroups: 0 };
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices);
  const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(messages);
  const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.isOnline, true));
  const [groupCount] = await db.select({ count: sql<number>`count(*)` }).from(groups);
  return {
    totalUsers: userCount?.count ?? 0,
    totalDevices: deviceCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    onlineDevices: onlineCount?.count ?? 0,
    totalGroups: groupCount?.count ?? 0,
  };
}

export async function getGroupStats(groupId: number) {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalDevices: 0, totalMessages: 0, onlineDevices: 0, allocatedQuota: 0 };

  // Get all frontline users in this group (exclude admin)
  const groupUsers = await db.select({ id: users.id, role: users.role, maxDevices: users.maxDevices })
    .from(users).where(eq(users.groupId, groupId));
  const frontlineUsers = groupUsers.filter(u => u.role === "user");
  const userIds = groupUsers.map(u => u.id);

  // Calculate allocated quota: sum of maxDevices for frontline users only
  const allocatedQuota = frontlineUsers.reduce((sum, u) => sum + (u.maxDevices ?? 0), 0);

  if (userIds.length === 0) {
    return { totalUsers: 0, totalDevices: 0, totalMessages: 0, onlineDevices: 0, allocatedQuota: 0 };
  }

  const userIdSql = sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`;

  const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(userIdSql);
  const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(and(userIdSql, eq(devices.isOnline, true)));

  // Get device ids for message count
  const groupDevices = await db.select({ id: devices.id }).from(devices).where(userIdSql);
  let msgCount = 0;
  if (groupDevices.length > 0) {
    const deviceIds = groupDevices.map(d => d.id);
    const [mc] = await db.select({ count: sql<number>`count(*)` }).from(messages)
      .where(sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`);
    msgCount = mc?.count ?? 0;
  }

  return {
    totalUsers: frontlineUsers.length,
    totalDevices: deviceCount?.count ?? 0,
    totalMessages: msgCount,
    onlineDevices: onlineCount?.count ?? 0,
    allocatedQuota,
  };
}

// ─── Device Queries ───

export async function createDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(devices).values(data);
  const result = await db.select().from(devices).where(eq(devices.deviceId, data.deviceId)).limit(1);
  return result[0];
}

export async function getDevicesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.createdAt));
}

export async function getDevicesByGroupId(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, groupId));
  if (groupUsers.length === 0) return [];
  const userIds = groupUsers.map(u => u.id);
  return db.select().from(devices)
    .where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(devices.createdAt));
}

export async function getDeviceByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1);
  return result[0];
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  return result[0];
}

export async function updateDevice(id: number, data: Partial<InsertDevice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(devices).set(data).where(eq(devices.id, id));
}

export async function deleteDevice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(messages).where(eq(messages.deviceId, id));
  await db.delete(devices).where(eq(devices.id, id));
}

export async function setDeviceOnline(deviceId: string, online: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(devices).set({ isOnline: online, lastSeen: new Date() }).where(eq(devices.deviceId, deviceId));
}

export async function updateDeviceStatus(deviceId: string, data: { batteryLevel?: number; signalStrength?: number; phoneModel?: string; androidVersion?: string; phoneNumber?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(devices).set({ ...data, lastSeen: new Date() }).where(eq(devices.deviceId, deviceId));
}

// ─── Pairing Token Queries ───

export async function createPairingToken(data: InsertPairingToken) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pairingTokens).values(data);
  const result = await db.select().from(pairingTokens).where(eq(pairingTokens.token, data.token)).limit(1);
  return result[0];
}

export async function getPairingTokenByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pairingTokens).where(eq(pairingTokens.token, token)).limit(1);
  return result[0];
}

export async function updatePairingToken(id: number, data: Partial<InsertPairingToken>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pairingTokens).set(data).where(eq(pairingTokens.id, id));
}

export async function expireOldTokens(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(pairingTokens)
    .set({ status: "expired" })
    .where(and(
      eq(pairingTokens.userId, userId),
      eq(pairingTokens.status, "pending"),
      lte(pairingTokens.expiresAt, new Date())
    ));
}

// ─── Message Queries ───

/** Normalize phone number: strip +86, spaces, dashes */
export function normalizePhone(phone: string): string {
  let n = phone.replace(/[\s\-()]/g, "");
  if (n.startsWith("+86")) n = n.slice(3);
  else if (n.startsWith("0086")) n = n.slice(4);
  else if (n.startsWith("86") && n.length === 13) n = n.slice(2);
  return n;
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Normalize phone number before saving
  const normalized = { ...data, phoneNumber: normalizePhone(data.phoneNumber) };
  
  // Dedup strategy 1: Exact match on deviceId + phoneNumber + smsTimestamp + direction
  // This prevents duplicate messages from Android sending both SMS_RECEIVED and SMS_DELIVER broadcasts
  const existing = await db.select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.deviceId, normalized.deviceId),
        eq(messages.phoneNumber, normalized.phoneNumber),
        eq(messages.smsTimestamp, normalized.smsTimestamp),
        eq(messages.direction, normalized.direction)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    console.log(`[DB] Dedup: skipping duplicate message (exact ts match, deviceId=${normalized.deviceId}, phone=${normalized.phoneNumber}, ts=${normalized.smsTimestamp}, dir=${normalized.direction})`);
    return { id: existing[0].id, ...normalized };
  }

  // Dedup strategy 2: For outgoing/incoming messages, check if same device + phone + body exists within 30s window
  // This catches duplicates from ContentObserver re-reporting messages that were already created by sendSms route
  // (timestamps differ slightly because server creates msg before phone actually sends it)
  if (normalized.body && normalized.body.length > 0 && normalized.body !== "[图片]") {
    const timeWindow = 30_000; // 30 seconds
    const tsMin = normalized.smsTimestamp - timeWindow;
    const tsMax = normalized.smsTimestamp + timeWindow;
    const bodyDedup = await db.select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.deviceId, normalized.deviceId),
          eq(messages.phoneNumber, normalized.phoneNumber),
          eq(messages.direction, normalized.direction),
          eq(messages.body, normalized.body),
          gte(messages.smsTimestamp, tsMin),
          lte(messages.smsTimestamp, tsMax)
        )
      )
      .limit(1);
    
    if (bodyDedup.length > 0) {
      console.log(`[DB] Dedup: skipping duplicate message (body+window match, deviceId=${normalized.deviceId}, phone=${normalized.phoneNumber}, body=${normalized.body.substring(0, 20)}...)`);
      return { id: bodyDedup[0].id, ...normalized };
    }
  }
  
  const result = await db.insert(messages).values(normalized);
  return { id: Number(result[0].insertId), ...normalized };
}

export async function getMessagesByDeviceId(deviceId: number, opts?: { limit?: number; offset?: number; search?: string; startTime?: number; endTime?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(messages.deviceId, deviceId)];

  if (opts?.search) {
    conditions.push(
      or(
        like(messages.body, `%${opts.search}%`),
        like(messages.phoneNumber, `%${opts.search}%`),
        like(messages.contactName, `%${opts.search}%`)
      )!
    );
  }
  if (opts?.startTime) {
    conditions.push(gte(messages.smsTimestamp, opts.startTime));
  }
  if (opts?.endTime) {
    conditions.push(lte(messages.smsTimestamp, opts.endTime));
  }

  return db.select().from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.smsTimestamp))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getAllMessagesByUserId(userId: number, opts?: { limit?: number; offset?: number; search?: string; deviceId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const userDevices = await db.select({ id: devices.id }).from(devices).where(eq(devices.userId, userId));
  if (userDevices.length === 0) return [];

  const deviceIds = userDevices.map(d => d.id);
  const conditions: any[] = [];

  if (opts?.deviceId) {
    conditions.push(eq(messages.deviceId, opts.deviceId));
  } else {
    conditions.push(sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`);
  }

  if (opts?.search) {
    conditions.push(
      or(
        like(messages.body, `%${opts.search}%`),
        like(messages.phoneNumber, `%${opts.search}%`),
        like(messages.contactName, `%${opts.search}%`)
      )!
    );
  }

  return db.select().from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.smsTimestamp))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getMessagesByGroupId(groupId: number, opts?: { limit?: number; offset?: number; search?: string; startTime?: number; endTime?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Get all user IDs in this group
  const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, groupId));
  if (groupUsers.length === 0) return [];
  const userIds = groupUsers.map(u => u.id);

  // Get all device IDs for these users
  const groupDevices = await db.select({ id: devices.id }).from(devices)
    .where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  if (groupDevices.length === 0) return [];
  const deviceIds = groupDevices.map(d => d.id);

  const conditions: any[] = [
    sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`
  ];

  if (opts?.search) {
    conditions.push(
      or(
        like(messages.body, `%${opts.search}%`),
        like(messages.phoneNumber, `%${opts.search}%`),
        like(messages.contactName, `%${opts.search}%`)
      )!
    );
  }
  if (opts?.startTime) {
    conditions.push(gte(messages.smsTimestamp, opts.startTime));
  }
  if (opts?.endTime) {
    conditions.push(lte(messages.smsTimestamp, opts.endTime));
  }

  return db.select().from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.smsTimestamp))
    .limit(opts?.limit ?? 200)
    .offset(opts?.offset ?? 0);
}

export async function getAllMessagesForSuperadmin(opts?: { limit?: number; offset?: number; search?: string; startTime?: number; endTime?: number; groupId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  // If filtering by group, get device IDs for that group
  if (opts?.groupId) {
    const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, opts.groupId));
    if (groupUsers.length === 0) return [];
    const userIds = groupUsers.map(u => u.id);
    const groupDevices = await db.select({ id: devices.id }).from(devices)
      .where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    if (groupDevices.length === 0) return [];
    const deviceIds = groupDevices.map(d => d.id);
    conditions.push(sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`);
  }

  if (opts?.search) {
    conditions.push(
      or(
        like(messages.body, `%${opts.search}%`),
        like(messages.phoneNumber, `%${opts.search}%`),
        like(messages.contactName, `%${opts.search}%`)
      )!
    );
  }
  if (opts?.startTime) {
    conditions.push(gte(messages.smsTimestamp, opts.startTime));
  }
  if (opts?.endTime) {
    conditions.push(lte(messages.smsTimestamp, opts.endTime));
  }

  return db.select().from(messages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(messages.smsTimestamp))
    .limit(opts?.limit ?? 200)
    .offset(opts?.offset ?? 0);
}

export async function updateMessageStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(messages).set({ status: status as any }).where(eq(messages.id, id));
}

export async function getMessageCountByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.deviceId, deviceId));
  return result[0]?.count ?? 0;
}

/** Export phone numbers with optional date range filter */
export async function getExportPhoneNumbers(opts: {
  userId?: number;
  groupId?: number;
  startTime?: number;
  endTime?: number;
  direction?: "incoming" | "outgoing";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (opts.direction) {
    conditions.push(eq(messages.direction, opts.direction));
  }
  if (opts.startTime) {
    conditions.push(gte(messages.smsTimestamp, opts.startTime));
  }
  if (opts.endTime) {
    conditions.push(lte(messages.smsTimestamp, opts.endTime));
  }

  // Scope by user or group
  if (opts.groupId) {
    const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, opts.groupId));
    if (groupUsers.length === 0) return [];
    const userIds = groupUsers.map(u => u.id);
    const groupDevices = await db.select({ id: devices.id }).from(devices)
      .where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    if (groupDevices.length === 0) return [];
    const deviceIds = groupDevices.map(d => d.id);
    conditions.push(sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`);
  } else if (opts.userId) {
    const userDevices = await db.select({ id: devices.id }).from(devices).where(eq(devices.userId, opts.userId));
    if (userDevices.length === 0) return [];
    const deviceIds = userDevices.map(d => d.id);
    conditions.push(sql`${messages.deviceId} IN (${sql.join(deviceIds.map(id => sql`${id}`), sql`, `)})`);
  }

  const result = await db.selectDistinct({ phoneNumber: messages.phoneNumber })
    .from(messages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(messages.phoneNumber));

  return result.map(r => r.phoneNumber);
}

// ─── System Config Queries ───

export async function getConfigValue(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemConfig).where(eq(systemConfig.configKey, key)).limit(1);
  return result.length > 0 ? (result[0].configValue ?? null) : null;
}

export async function setConfigValue(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(systemConfig).values({
    configKey: key,
    configValue: value,
    description: description || null,
  }).onDuplicateKeyUpdate({
    set: { configValue: value },
  });
}

export async function getAllConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfig).orderBy(asc(systemConfig.configKey));
}

/** Get sum of maxDevices for frontline users only in a group (allocated quota) */
export async function getGroupAllocatedDevices(groupId: number) {
  const db = await getDb();
  if (!db) return 0;
  // Only count frontline users (role='user'), exclude admin accounts
  const result = await db.select({ total: sql<number>`COALESCE(SUM(${users.maxDevices}), 0)` })
    .from(users)
    .where(and(eq(users.groupId, groupId), eq(users.role, "user")));
  return result[0]?.total ?? 0;
}

// ─── SMS Template Queries ───

export async function getTemplatesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsTemplates).where(eq(smsTemplates.userId, userId)).orderBy(asc(smsTemplates.sortOrder), desc(smsTemplates.createdAt));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(smsTemplates).where(eq(smsTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createTemplate(data: InsertSmsTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(smsTemplates).values(data);
  return { id: Number(result[0].insertId), ...data };
}

export async function updateTemplate(id: number, data: Partial<InsertSmsTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(smsTemplates).set(data).where(eq(smsTemplates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
}

// ─── Device Contact Queries ───

export async function getContactsByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deviceContacts).where(eq(deviceContacts.deviceId, deviceId)).orderBy(desc(deviceContacts.createdAt));
}

export async function getContactCountByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(deviceContacts).where(eq(deviceContacts.deviceId, deviceId));
  return result[0]?.count ?? 0;
}

export async function importContacts(userId: number, deviceId: number, contacts: { name: string; phoneNumber: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (contacts.length === 0) return 0;

  // Get existing phone numbers for this device to deduplicate
  const existing = await db.select({ phoneNumber: deviceContacts.phoneNumber })
    .from(deviceContacts)
    .where(eq(deviceContacts.deviceId, deviceId));
  const existingSet = new Set(existing.map(e => e.phoneNumber));

  const newContacts = contacts.filter(c => !existingSet.has(c.phoneNumber));
  if (newContacts.length === 0) return 0;

  await db.insert(deviceContacts).values(
    newContacts.map(c => ({
      userId,
      deviceId,
      name: c.name,
      phoneNumber: c.phoneNumber,
    }))
  );
  return newContacts.length;
}

export async function clearContactsByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deviceContacts).where(eq(deviceContacts.deviceId, deviceId));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deviceContacts).where(eq(deviceContacts.id, id));
}

// ─── Bulk Task Queries ───

export async function createBulkTask(data: InsertBulkTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bulkTasks).values(data);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(bulkTasks).where(eq(bulkTasks.id, id)).limit(1);
  return rows[0];
}

export async function getBulkTaskById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bulkTasks).where(eq(bulkTasks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBulkTasksByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bulkTasks).where(eq(bulkTasks.userId, userId)).orderBy(desc(bulkTasks.createdAt));
}

export async function getRunningTaskByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bulkTasks)
    .where(and(eq(bulkTasks.deviceId, deviceId), eq(bulkTasks.status, "running")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateBulkTask(id: number, data: Partial<InsertBulkTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bulkTasks).set(data).where(eq(bulkTasks.id, id));
}

export async function deleteBulkTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bulkTasks).where(eq(bulkTasks.id, id));
}

// ─── Pinned Contacts ───

export async function getPinnedContacts(deviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pinnedContacts)
    .where(eq(pinnedContacts.deviceId, deviceId))
    .orderBy(desc(pinnedContacts.pinnedAt));
}

export async function pinContact(deviceId: number, phoneNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already pinned
  const existing = await db.select().from(pinnedContacts)
    .where(and(eq(pinnedContacts.deviceId, deviceId), eq(pinnedContacts.phoneNumber, phoneNumber)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(pinnedContacts).values({ deviceId, phoneNumber });
  const result = await db.select().from(pinnedContacts)
    .where(and(eq(pinnedContacts.deviceId, deviceId), eq(pinnedContacts.phoneNumber, phoneNumber)))
    .limit(1);
  return result[0];
}

export async function unpinContact(deviceId: number, phoneNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pinnedContacts)
    .where(and(eq(pinnedContacts.deviceId, deviceId), eq(pinnedContacts.phoneNumber, phoneNumber)));
}

// ─── Statistics: Per-device send/reply stats ───

/**
 * Get statistics per device for a user within a date range.
 * For each device, counts:
 * - totalSent: number of outgoing messages
 * - singleReply: contacts who replied exactly once (only 1 incoming message)
 * - multiReply: contacts who replied more than once (2+ incoming messages)
 */
export async function getDeviceStats(userId: number, opts?: { startTime?: number; endTime?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Get all devices for this user
  const userDevices = await db.select({ id: devices.id, name: devices.name, deviceId: devices.deviceId })
    .from(devices).where(eq(devices.userId, userId));

  if (userDevices.length === 0) return [];

  const results = [];

  for (const device of userDevices) {
    // Build conditions
    const sentConditions: any[] = [eq(messages.deviceId, device.id), eq(messages.direction, "outgoing")];
    const incomingConditions: any[] = [eq(messages.deviceId, device.id), eq(messages.direction, "incoming")];

    if (opts?.startTime) {
      sentConditions.push(gte(messages.smsTimestamp, opts.startTime));
      incomingConditions.push(gte(messages.smsTimestamp, opts.startTime));
    }
    if (opts?.endTime) {
      sentConditions.push(lte(messages.smsTimestamp, opts.endTime));
      incomingConditions.push(lte(messages.smsTimestamp, opts.endTime));
    }

    // Count total sent messages
    const [sentResult] = await db.select({ count: sql<number>`count(*)` })
      .from(messages).where(and(...sentConditions));
    const totalSent = sentResult?.count ?? 0;

    // Count incoming messages grouped by phoneNumber
    const replyGroups = await db.select({
      phoneNumber: messages.phoneNumber,
      replyCount: sql<number>`count(*)`,
    })
      .from(messages)
      .where(and(...incomingConditions))
      .groupBy(messages.phoneNumber);

    let singleReply = 0;
    let multiReply = 0;
    for (const rg of replyGroups) {
      if (rg.replyCount === 1) {
        singleReply++;
      } else if (rg.replyCount > 1) {
        multiReply++;
      }
    }

    results.push({
      deviceId: device.id,
      deviceName: device.name,
      totalSent,
      singleReply,
      multiReply,
    });
  }

  return results;
}

/**
 * Get statistics for ALL devices across all users (for superadmin/auditor).
 * Returns same structure as getDeviceStats but includes userName and grouped by user.
 */
export async function getAllDeviceStats(opts?: { startTime?: number; endTime?: number; groupId?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Get all devices, joined with user info
  let allDevices;
  if (opts?.groupId) {
    // Filter by group: get users in this group first
    const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, opts.groupId));
    if (groupUsers.length === 0) return [];
    const userIds = groupUsers.map(u => u.id);
    allDevices = await db.select({
      id: devices.id,
      name: devices.name,
      deviceId: devices.deviceId,
      userId: devices.userId,
    }).from(devices).where(sql`${devices.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  } else {
    allDevices = await db.select({
      id: devices.id,
      name: devices.name,
      deviceId: devices.deviceId,
      userId: devices.userId,
    }).from(devices);
  }

  if (allDevices.length === 0) return [];

  // Get user names in batch
  const userIds = Array.from(new Set(allDevices.map(d => d.userId)));
  const userList = await db.select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  const userMap = new Map(userList.map(u => [u.id, u.name || u.username || `用户${u.id}`]));

  const results = [];

  for (const device of allDevices) {
    const sentConditions: any[] = [eq(messages.deviceId, device.id), eq(messages.direction, "outgoing")];
    const incomingConditions: any[] = [eq(messages.deviceId, device.id), eq(messages.direction, "incoming")];

    if (opts?.startTime) {
      sentConditions.push(gte(messages.smsTimestamp, opts.startTime));
      incomingConditions.push(gte(messages.smsTimestamp, opts.startTime));
    }
    if (opts?.endTime) {
      sentConditions.push(lte(messages.smsTimestamp, opts.endTime));
      incomingConditions.push(lte(messages.smsTimestamp, opts.endTime));
    }

    const [sentResult] = await db.select({ count: sql<number>`count(*)` })
      .from(messages).where(and(...sentConditions));
    const totalSent = sentResult?.count ?? 0;

    const replyGroups = await db.select({
      phoneNumber: messages.phoneNumber,
      replyCount: sql<number>`count(*)`,
    })
      .from(messages)
      .where(and(...incomingConditions))
      .groupBy(messages.phoneNumber);

    let singleReply = 0;
    let multiReply = 0;
    for (const rg of replyGroups) {
      if (rg.replyCount === 1) singleReply++;
      else if (rg.replyCount > 1) multiReply++;
    }

    results.push({
      deviceId: device.id,
      deviceName: device.name,
      userName: userMap.get(device.userId) || `用户${device.userId}`,
      userId: device.userId,
      totalSent,
      singleReply,
      multiReply,
    });
  }

  return results;
}


// ─── Chat Contact List (independent of message limit) ───

/**
 * Get all unique contacts for a device with their latest message info.
 * This query is NOT limited by message count, so all contacts will appear.
 */
export async function getChatContactsByDeviceId(deviceId: number) {
  const db = await getDb();
  if (!db) return [];

  // Use a subquery to get the latest message per contact (phone number)
  const result = await db.select({
    phoneNumber: messages.phoneNumber,
    contactName: sql<string>`MAX(${messages.contactName})`.as("contactName"),
    lastMessage: sql<string>`SUBSTRING(MAX(CONCAT(LPAD(${messages.smsTimestamp}, 20, '0'), ${messages.body})), 21)`.as("lastMessage"),
    lastTime: sql<number>`MAX(${messages.smsTimestamp})`.as("lastTime"),
    totalMessages: sql<number>`COUNT(*)`.as("totalMessages"),
    incomingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'incoming' THEN 1 ELSE 0 END)`.as("incomingCount"),
    outgoingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'outgoing' THEN 1 ELSE 0 END)`.as("outgoingCount"),
  })
    .from(messages)
    .where(eq(messages.deviceId, deviceId))
    .groupBy(messages.phoneNumber)
    .orderBy(sql`MAX(${messages.smsTimestamp}) DESC`);

  return result.map(r => ({
    phoneNumber: r.phoneNumber,
    contactName: r.contactName || null,
    lastMessage: r.lastMessage ? (r.lastMessage.length > 30 ? r.lastMessage.slice(0, 30) + "..." : r.lastMessage) : "",
    lastTime: r.lastTime,
    totalMessages: Number(r.totalMessages),
    incomingCount: Number(r.incomingCount),
    outgoingCount: Number(r.outgoingCount),
    hasReplied: Number(r.incomingCount) > 0,
  }));
}


// ─── Messages by Contact (for chat view) ───

/**
 * Get messages for a specific device + phone number combination.
 * Returns all messages for that contact, ordered by time ascending.
 */
export async function getMessagesByContact(deviceId: number, phoneNumber: string, opts?: { limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(messages)
    .where(and(
      eq(messages.deviceId, deviceId),
      eq(messages.phoneNumber, phoneNumber)
    ))
    .orderBy(desc(messages.smsTimestamp))
    .limit(opts?.limit ?? 500)
    .offset(opts?.offset ?? 0);
}


// ─── Chat Records: Get contacts with messages in a date range ───
export async function getChatContactsByDeviceIdAndDate(deviceId: number, startTime: number, endTime: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    phoneNumber: messages.phoneNumber,
    contactName: sql<string>`MAX(${messages.contactName})`.as("contactName"),
    lastMessage: sql<string>`SUBSTRING(MAX(CONCAT(LPAD(${messages.smsTimestamp}, 20, '0'), ${messages.body})), 21)`.as("lastMessage"),
    lastTime: sql<number>`MAX(${messages.smsTimestamp})`.as("lastTime"),
    totalMessages: sql<number>`COUNT(*)`.as("totalMessages"),
    incomingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'incoming' THEN 1 ELSE 0 END)`.as("incomingCount"),
    outgoingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'outgoing' THEN 1 ELSE 0 END)`.as("outgoingCount"),
  })
    .from(messages)
    .where(and(
      eq(messages.deviceId, deviceId),
      gte(messages.smsTimestamp, startTime),
      lte(messages.smsTimestamp, endTime)
    ))
    .groupBy(messages.phoneNumber)
    .orderBy(sql`MAX(${messages.smsTimestamp}) DESC`);
  return result.map(r => ({
    phoneNumber: r.phoneNumber,
    contactName: r.contactName || null,
    lastMessage: r.lastMessage ? (r.lastMessage.length > 30 ? r.lastMessage.slice(0, 30) + "..." : r.lastMessage) : "",
    lastTime: r.lastTime,
    totalMessages: Number(r.totalMessages),
    incomingCount: Number(r.incomingCount),
    outgoingCount: Number(r.outgoingCount),
    hasReplied: Number(r.incomingCount) > 0,
  }));
}

// ─── Chat Records: Get messages for a contact within a date range ───
export async function getMessagesByContactAndDate(deviceId: number, phoneNumber: string, startTime: number, endTime: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(and(
      eq(messages.deviceId, deviceId),
      eq(messages.phoneNumber, phoneNumber),
      gte(messages.smsTimestamp, startTime),
      lte(messages.smsTimestamp, endTime)
    ))
    .orderBy(asc(messages.smsTimestamp))
    .limit(2000);
}

// ─── Chat Records: Search contacts by name, phone, or message content ───
export async function searchChatContacts(deviceId: number, startTime: number, endTime: number, keyword: string) {
  const db = await getDb();
  if (!db) return [];
  const q = `%${keyword}%`;
  // Find all phoneNumbers that match: contactName, phoneNumber, or body contains keyword
  const matchedPhones = await db.selectDistinct({ phoneNumber: messages.phoneNumber })
    .from(messages)
    .where(and(
      eq(messages.deviceId, deviceId),
      gte(messages.smsTimestamp, startTime),
      lte(messages.smsTimestamp, endTime),
      or(
        like(messages.phoneNumber, q),
        like(messages.contactName, q),
        like(messages.body, q)
      )
    ));
  if (matchedPhones.length === 0) return [];
  const phoneList = matchedPhones.map(p => p.phoneNumber);
  // Now get full contact aggregation for those phone numbers
  const result = await db.select({
    phoneNumber: messages.phoneNumber,
    contactName: sql<string>`MAX(${messages.contactName})`.as("contactName"),
    lastMessage: sql<string>`SUBSTRING(MAX(CONCAT(LPAD(${messages.smsTimestamp}, 20, '0'), ${messages.body})), 21)`.as("lastMessage"),
    lastTime: sql<number>`MAX(${messages.smsTimestamp})`.as("lastTime"),
    totalMessages: sql<number>`COUNT(*)`.as("totalMessages"),
    incomingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'incoming' THEN 1 ELSE 0 END)`.as("incomingCount"),
    outgoingCount: sql<number>`SUM(CASE WHEN ${messages.direction} = 'outgoing' THEN 1 ELSE 0 END)`.as("outgoingCount"),
  })
    .from(messages)
    .where(and(
      eq(messages.deviceId, deviceId),
      gte(messages.smsTimestamp, startTime),
      lte(messages.smsTimestamp, endTime),
      inArray(messages.phoneNumber, phoneList)
    ))
    .groupBy(messages.phoneNumber)
    .orderBy(sql`MAX(${messages.smsTimestamp}) DESC`);
  return result.map(r => ({
    phoneNumber: r.phoneNumber,
    contactName: r.contactName || null,
    lastMessage: r.lastMessage ? (r.lastMessage.length > 30 ? r.lastMessage.slice(0, 30) + "..." : r.lastMessage) : "",
    lastTime: r.lastTime,
    totalMessages: Number(r.totalMessages),
    incomingCount: Number(r.incomingCount),
    outgoingCount: Number(r.outgoingCount),
    hasReplied: Number(r.incomingCount) > 0,
  }));
}

// ─── Chat Records: Get all devices visible to a role ───
export async function getDevicesForChatRecords(userId: number, role: string, groupId: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  if (role === "superadmin" || role === "auditor") {
    // Can see all devices across all groups
    const allDevices = await db.select({
      id: devices.id,
      deviceId: devices.deviceId,
      name: devices.name,
      phoneNumber: devices.phoneNumber,
      userId: devices.userId,
    }).from(devices).orderBy(desc(devices.createdAt));
    
    // Enrich with owner info and group info
    const result = [];
    for (const d of allDevices) {
      const owner = await getUserById(d.userId);
      let groupName = "未分组";
      if (owner?.groupId) {
        const group = await getGroupById(owner.groupId);
        groupName = group?.name || "未知分组";
      }
      result.push({
        ...d,
        ownerName: owner?.name || owner?.username || "未知",
        groupName,
        groupId: owner?.groupId || null,
      });
    }
    return result;
  } else if (role === "admin") {
    // Can see devices in their group
    if (!groupId) return [];
    const groupDevices = await getDevicesByGroupId(groupId);
    const result = [];
    for (const d of groupDevices) {
      const owner = await getUserById(d.userId);
      result.push({
        id: d.id,
        deviceId: d.deviceId,
        name: d.name,
        phoneNumber: d.phoneNumber,
        userId: d.userId,
        ownerName: owner?.name || owner?.username || "未知",
        groupName: "",
        groupId,
      });
    }
    return result;
  }
  return [];
}
