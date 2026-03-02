import { eq, and, desc, like, or, gte, lte, sql, asc, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, devices, pairingTokens, messages, systemConfig, groups, type InsertDevice, type InsertPairingToken, type InsertMessage, type InsertGroup } from "../drizzle/schema";
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
  if (!db) return { totalUsers: 0, totalDevices: 0, totalMessages: 0, onlineDevices: 0 };

  const groupUsers = await db.select({ id: users.id }).from(users).where(eq(users.groupId, groupId));
  const userIds = groupUsers.map(u => u.id);

  if (userIds.length === 0) {
    return { totalUsers: 0, totalDevices: 0, totalMessages: 0, onlineDevices: 0 };
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
    totalUsers: groupUsers.length,
    totalDevices: deviceCount?.count ?? 0,
    totalMessages: msgCount,
    onlineDevices: onlineCount?.count ?? 0,
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

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return { id: Number(result[0].insertId), ...data };
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

/** Get sum of maxDevices for all users in a group (allocated quota) */
export async function getGroupAllocatedDevices(groupId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: sql<number>`COALESCE(SUM(${users.maxDevices}), 0)` })
    .from(users)
    .where(and(eq(users.groupId, groupId), eq(users.role, "user")));
  return result[0]?.total ?? 0;
}
