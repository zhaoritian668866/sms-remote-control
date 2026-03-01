import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
