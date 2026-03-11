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
  role: mysqlEnum("role", ["user", "admin", "superadmin", "auditor"]).default("user").notNull(),
  /** The group this user belongs to (null for superadmin) */
  groupId: int("groupId"),
  /** Maximum number of devices this user can connect */
  maxDevices: int("maxDevices").default(1).notNull(),
  /** Whether the account is enabled */
  isActive: boolean("isActive").default(true).notNull(),
  /** Session version - incremented on each login, used to invalidate old sessions */
  sessionVersion: int("sessionVersion").default(1).notNull(),
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
  /** Hardware fingerprint (e.g. Android ID) for identifying the same physical phone across re-pairings */
  hardwareId: varchar("hardwareId", { length: 128 }),
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
  /** Message type: text (SMS) or image (MMS with image) */
  messageType: mysqlEnum("messageType", ["text", "image"]).default("text").notNull(),
  /** URL of the image stored in S3 (only for image messages) */
  imageUrl: varchar("imageUrl", { length: 1024 }),
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

/**
 * SMS templates - shared across all devices for a user.
 * Supports {姓名} variable placeholder.
 */
export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Template content, use {姓名} as placeholder */
  content: text("content").notNull(),
  /** Optional label for easy identification */
  label: varchar("label", { length: 128 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

/**
 * Device contacts - imported per device for bulk sending.
 * Each row is a name + phone number pair bound to a specific device.
 */
export const deviceContacts = mysqlTable("device_contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceId: int("deviceId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DeviceContact = typeof deviceContacts.$inferSelect;
export type InsertDeviceContact = typeof deviceContacts.$inferInsert;

/**
 * Bulk SMS tasks - each task sends messages to a list of contacts via one device.
 */
export const bulkTasks = mysqlTable("bulk_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  deviceId: int("deviceId").notNull(),
  /** Sending mode: round_robin (轮流) or random (随机) */
  mode: mysqlEnum("mode", ["round_robin", "random"]).default("round_robin").notNull(),
  /** Interval between each SMS in seconds */
  intervalSeconds: int("intervalSeconds").default(10).notNull(),
  /** JSON array of template IDs to use */
  templateIds: text("templateIds").notNull(),
  /** JSON array of contact objects [{name, phoneNumber}] */
  contacts: text("contacts").notNull(),
  /** Total number of contacts to send */
  totalCount: int("totalCount").default(0).notNull(),
  /** Current index (how many have been processed) */
  currentIndex: int("currentIndex").default(0).notNull(),
  /** Number of successfully sent */
  successCount: int("successCount").default(0).notNull(),
  /** Number of failed sends */
  failCount: int("failCount").default(0).notNull(),
  /** Task status */
  status: mysqlEnum("status", ["pending", "running", "paused", "completed", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BulkTask = typeof bulkTasks.$inferSelect;
export type InsertBulkTask = typeof bulkTasks.$inferInsert;

/**
 * Pinned contacts - each device can pin up to 10 contacts to the top of chat list.
 */
export const pinnedContacts = mysqlTable("pinned_contacts", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  pinnedAt: timestamp("pinnedAt").defaultNow().notNull(),
});

export type PinnedContact = typeof pinnedContacts.$inferSelect;
export type InsertPinnedContact = typeof pinnedContacts.$inferInsert;

/**
 * Contact read status - persists the last read timestamp per device+contact.
 * Used to track which messages have been read by the user, surviving reconnections.
 */
export const contactReadStatus = mysqlTable("contact_read_status", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  /** Unix timestamp (ms) of the last time the user read this contact's messages */
  lastReadAt: bigint("lastReadAt", { mode: "number" }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContactReadStatus = typeof contactReadStatus.$inferSelect;
export type InsertContactReadStatus = typeof contactReadStatus.$inferInsert;

/**
 * AI auto-reply configuration - global settings managed by superadmin.
 * Uses OpenAI-compatible API format (works with DeepSeek, Qwen, etc.)
 */
export const aiConfig = mysqlTable("ai_config", {
  id: int("id").autoincrement().primaryKey(),
  /** OpenAI-compatible API base URL (e.g. https://api.openai.com/v1) */
  apiUrl: varchar("apiUrl", { length: 512 }).notNull(),
  /** API Key */
  apiKey: varchar("apiKey", { length: 512 }).notNull(),
  /** Model name (e.g. gpt-4o-mini, deepseek-chat) */
  modelName: varchar("modelName", { length: 128 }).notNull(),
  /** Whether AI auto-reply is globally enabled */
  isEnabled: boolean("isEnabled").default(false).notNull(),
  /** SMS banned words list (JSON array of strings) */
  bannedWords: text("bannedWords"),
  /** Banned word replacements (JSON object: {"banned": "replacement"}) */
  bannedWordReplacements: text("bannedWordReplacements"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiConfig = typeof aiConfig.$inferSelect;
export type InsertAiConfig = typeof aiConfig.$inferInsert;

/**
 * AI auto-reply user settings - per-user (messenger) AI configuration.
 */
export const aiUserSettings = mysqlTable("ai_user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Whether AI auto-reply is enabled for this user */
  isEnabled: boolean("isEnabled").default(false).notNull(),
  /** AI persona name (the name AI uses to introduce itself) */
  personaName: varchar("personaName", { length: 64 }).notNull().default("小美"),
  /** Target APP name to guide customers to (e.g. WeChat, Telegram) */
  targetApp: varchar("targetApp", { length: 128 }).notNull().default("微信"),
  /** Target APP ID or contact info to give customers */
  targetAppId: varchar("targetAppId", { length: 256 }),
  /** Custom system prompt override (optional, for advanced users) */
  customPrompt: text("customPrompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiUserSettings = typeof aiUserSettings.$inferSelect;
export type InsertAiUserSettings = typeof aiUserSettings.$inferInsert;

/**
 * AI conversation tracking - tracks AI dialogue state per device+contact.
 * Used to manage the 10-round conversation strategy and extracted customer info.
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  /** Current conversation round (1-10) */
  currentRound: int("currentRound").default(0).notNull(),
  /** Whether AI auto-reply is active for this contact (auto-disabled after 10 rounds) */
  isActive: boolean("isActive").default(true).notNull(),
  /** Extracted customer age (null if not yet obtained) */
  customerAge: int("customerAge"),
  /** Extracted customer job/occupation */
  customerJob: varchar("customerJob", { length: 128 }),
  /** Extracted customer income range */
  customerIncome: varchar("customerIncome", { length: 128 }),
  /** Extracted customer marital status */
  customerMaritalStatus: varchar("customerMaritalStatus", { length: 64 }),
  /** Conversation history summary (JSON array of {role, content}) for context */
  conversationHistory: text("conversationHistory"),
  /** Whether customer has been guided to target APP */
  hasGuidedToApp: boolean("hasGuidedToApp").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;
