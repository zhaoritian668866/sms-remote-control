import { eq, and, desc, like, or, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, devices, pairingTokens, messages, type InsertDevice, type InsertPairingToken, type InsertMessage } from "../drizzle/schema";
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
      values.role = 'admin';
      updateSet.role = 'admin';
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
