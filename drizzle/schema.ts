import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean } from "drizzle-orm/mysql-core";

/**
 * User groups (子后台/用户组) - managed by superadmin.
 * Each group has a unique code that frontline users use during registration.
 */
export const groups = mysqlTable("groups", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique invite code for frontline users to bind during registration */
  groupCode: varchar("groupCode", { length: 32 }).notNull().unique(),
  /** Display name of the group */
  name: varchar("name", { length: 128 }).notNull(),
  /** Total device quota allocated to this group by superadmin */
  maxDevices: int("maxDevices").default(10).notNull(),
  /** Whether the group is enabled */
  isActive: boolean("isActive").default(true).notNull(),
  /** The admin user who manages this group (set after admin account is created) */
  adminUserId: int("adminUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

/**
 * Core user table - three-level role system.
 * superadmin: Platform owner, manages groups and admins
 * admin: Group manager, manages frontline users within their group
 * user: Frontline operator, can only use devices assigned to them
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  /** The group this user belongs to (null for superadmin) */
  groupId: int("groupId"),
  /** Maximum number of devices this user can connect */
  maxDevices: int("maxDevices").default(1).notNull(),
  /** Whether the account is enabled */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Devices table - each row represents a paired Android phone.
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceId: varchar("deviceId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  phoneModel: varchar("phoneModel", { length: 128 }),
  androidVersion: varchar("androidVersion", { length: 32 }),
  phoneNumber: varchar("phoneNumber", { length: 32 }),
  isOnline: boolean("isOnline").default(false).notNull(),
  batteryLevel: int("batteryLevel"),
  signalStrength: int("signalStrength"),
  lastSeen: timestamp("lastSeen"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * Pairing tokens - generated when user clicks "Add Device", scanned by phone.
 */
export const pairingTokens = mysqlTable("pairing_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  wsUrl: varchar("wsUrl", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["pending", "paired", "expired"]).default("pending").notNull(),
  deviceId: int("deviceId"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PairingToken = typeof pairingTokens.$inferSelect;
export type InsertPairingToken = typeof pairingTokens.$inferInsert;

/**
 * SMS messages - stores all sent and received messages.
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  direction: mysqlEnum("direction", ["incoming", "outgoing"]).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  contactName: varchar("contactName", { length: 128 }),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "received"]).default("received").notNull(),
  smsTimestamp: bigint("smsTimestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * System configuration table - stores key-value pairs for system settings.
 */
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 128 }).notNull().unique(),
  configValue: text("configValue"),
  description: varchar("description", { length: 256 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;
