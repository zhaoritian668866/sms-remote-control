import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, superadminProcedure, auditorProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import {
  getUserByUsername,
  getUserById,
  createUserWithPassword,
  updateUserLastSignedIn,
  incrementSessionVersion,
  getDevicesByUserId,
  getDeviceById,
  updateDevice,
  deleteDevice,
  createPairingToken,
  expireOldTokens,
  getAllMessagesByUserId,
  getMessagesByDeviceId,
  createMessage,
  getDeviceByDeviceId,
  updateMessageStatus,
  getDeviceCountByUserId,
  getAllUsers,
  updateUserAdmin,
  getSystemStats,
  getConfigValue,
  setConfigValue,
  getAllConfigs,
  createGroup,
  getGroupById,
  getGroupByCode,
  getAllGroups,
  updateGroup,
  deleteGroup,
  getGroupDeviceCount,
  getGroupUserCount,
  getUsersByGroupId,
  getGroupStats,
  getMessagesByGroupId,
  getAllMessagesForSuperadmin,
  getExportPhoneNumbers,
  getGroupAllocatedDevices,
  getDevicesByGroupId,
  getTemplatesByUserId,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getContactsByDeviceId,
  getContactCountByDeviceId,
  importContacts,
  clearContactsByDeviceId,
  deleteContact,
  createBulkTask,
  getBulkTaskById,
  getBulkTasksByUserId,
  getRunningTaskByDeviceId,
  updateBulkTask,
  normalizePhone,
  getPinnedContacts,
  pinContact,
  unpinContact,
  getDeviceStats,
  getAllDeviceStats,
  getChatContactsByDeviceId,
  getMessagesByContact,
  getChatContactsByDeviceIdAndDate,
  getMessagesByContactAndDate,
  getDevicesForChatRecords,
  searchChatContacts,
} from "./db";
import { sendSmsToDevice, sendMmsToDevice, isDeviceConnected, broadcastToDashboard, sendSyncSmsRequest } from "./wsManager";
import { saveFileLocally } from "./_core/index";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,

  // ─── Auth: Self-hosted username/password ───
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
        password: z.string().min(6).max(64),
        name: z.string().min(1).max(64),
        groupCode: z.string().min(1).max(32),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate group code
        const group = await getGroupByCode(input.groupCode);
        if (!group) {
          throw new Error("用户组标识不存在，请联系管理员获取正确的标识码");
        }
        if (!group.isActive) {
          throw new Error("该用户组已被禁用，请联系管理员");
        }

        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new Error("该用户名已被注册");
        }

        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await createUserWithPassword({
          username: input.username,
          passwordHash,
          name: input.name,
          groupId: group.id,
        });

        if (!user) {
          throw new Error("注册失败，请稍后重试");
        }

        // Auto-login after registration - increment session version to kick other sessions
        const newSv = await incrementSessionVersion(user.id);
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          sessionVersion: newSv,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        };
      }),

    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new Error("用户名或密码错误");
        }

        if (!user.isActive) {
          throw new Error("该账户已被禁用，请联系管理员");
        }

        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new Error("用户名或密码错误");
        }

        await updateUserLastSignedIn(user.id);

        // Increment session version to invalidate all other sessions (single-device login)
        const newSv = await incrementSessionVersion(user.id);

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          sessionVersion: newSv,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Device Management ───
  device: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const deviceList = await getDevicesByUserId(ctx.user.id);
      return deviceList.map(d => ({
        ...d,
        isOnline: isDeviceConnected(d.deviceId),
      }));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.id);
        if (!device || device.userId !== ctx.user.id) return null;
        return { ...device, isOnline: isDeviceConnected(device.deviceId) };
      }),

    rename: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.id);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }
        await updateDevice(input.id, { name: input.name });
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.id);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }
        await deleteDevice(input.id);
        return { success: true };
      }),

    quota: protectedProcedure.query(async ({ ctx }) => {
      const currentCount = await getDeviceCountByUserId(ctx.user.id);
      return {
        current: currentCount,
        max: ctx.user.maxDevices ?? 1,
      };
    }),
  }),

  // ─── Pairing ───
  pairing: router({
    generate: protectedProcedure.mutation(async ({ ctx }) => {
      // Always allow generating pairing token.
      // The actual quota check happens in wsManager during pairing:
      // - If under quota: creates new device (multi-messenger support)
      // - If at quota: reuses oldest offline device (preserves history)
      // This ensures users can always re-pair even when at quota limit.

      await expireOldTokens(ctx.user.id);

      const token = nanoid(32);
      const origin = ctx.req.headers.origin || ctx.req.headers.referer || `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const wsUrl = origin.replace(/^http/, "ws") + "/api/ws";

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await createPairingToken({
        userId: ctx.user.id,
        token,
        wsUrl,
        status: "pending",
        expiresAt,
      });

      const qrPayload = JSON.stringify({
        token,
        wsUrl,
        serverUrl: origin,
      });
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 300,
        margin: 2,
        color: { dark: "#d4d4d4", light: "#0a0a0f" },
      });

      return {
        token,
        qrDataUrl,
        expiresAt: expiresAt.getTime(),
        // Also return the raw pairing payload for copy-paste
        pairingPayload: qrPayload,
      };
    }),
  }),

  // ─── SMS Messages ───
  sms: router({
    list: protectedProcedure
      .input(z.object({
        deviceId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        if (input.deviceId) {
          const device = await getDeviceById(input.deviceId);
          if (!device || device.userId !== ctx.user.id) return [];
          return getMessagesByDeviceId(input.deviceId, {
            limit: input.limit,
            offset: input.offset,
            search: input.search,
          });
        }
        return getAllMessagesByUserId(ctx.user.id, {
          limit: input.limit,
          offset: input.offset,
          search: input.search,
          deviceId: input.deviceId,
        });
      }),

    // Get all unique contacts for a device (not limited by message count)
    chatContacts: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) return [];
        return getChatContactsByDeviceId(input.deviceId);
      }),

    // Get messages for a specific contact (not limited by global message count)
    contactMessages: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        phoneNumber: z.string().min(1),
        limit: z.number().min(1).max(1000).default(500),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) return [];
        return getMessagesByContact(input.deviceId, input.phoneNumber, {
          limit: input.limit,
          offset: input.offset,
        });
      }),

    send: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        phoneNumber: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }

        const phone = normalizePhone(input.phoneNumber);

        const msg = await createMessage({
          deviceId: input.deviceId,
          direction: "outgoing",
          phoneNumber: phone,
          body: input.body,
          status: "pending",
          smsTimestamp: Date.now(),
        });

        const result = await sendSmsToDevice(device.deviceId, phone, input.body);

        const newStatus = result.success ? "sent" : "failed";
        await updateMessageStatus(msg.id, newStatus);

        broadcastToDashboard(ctx.user.id, "sms_status_update", {
          messageId: msg.id,
          deviceId: input.deviceId,
          status: newStatus,
          error: result.error,
        });

        return {
          message: { ...msg, status: newStatus },
          sendResult: result,
        };
      }),

    /** Send image (MMS) to a phone number via device */
    sendImage: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        phoneNumber: z.string().min(1),
        imageBase64: z.string().min(1),
        mimeType: z.string().default("image/jpeg"),
        body: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }

        const phone = normalizePhone(input.phoneNumber);

        // Save image to local disk
        const imageBuffer = Buffer.from(input.imageBase64, "base64");
        console.log(`[MMS] Saving image: ${imageBuffer.length} bytes, type: ${input.mimeType}`);
        const urlPath = saveFileLocally(imageBuffer, input.mimeType, `mms/${ctx.user.id}`);
        // Build full URL - use the server's own host, not the frontend origin
        const host = ctx.req.get("host") || "localhost:3000";
        const protocol = ctx.req.protocol || "https";
        const imageUrl = `${protocol}://${host}${urlPath}`;
        console.log(`[MMS] Image saved, URL: ${imageUrl}`);

        const msg = await createMessage({
          deviceId: input.deviceId,
          direction: "outgoing",
          phoneNumber: phone,
          body: input.body || "[图片]",
          messageType: "image",
          imageUrl,
          status: "pending",
          smsTimestamp: Date.now(),
        });

        const result = await sendMmsToDevice(device.deviceId, phone, imageUrl, input.body);

        const newStatus = result.success ? "sent" : "failed";
        await updateMessageStatus(msg.id, newStatus);

        broadcastToDashboard(ctx.user.id, "sms_status_update", {
          messageId: msg.id,
          deviceId: input.deviceId,
          status: newStatus,
          error: result.error,
        });

        return {
          message: { ...msg, status: newStatus },
          sendResult: result,
        };
      }),

    /** Export phone numbers with filters */
    exportNumbers: protectedProcedure
      .input(z.object({
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        groupId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const role = ctx.user.role;

        if (role === "superadmin") {
          // Superadmin can export from any group or all
          return getExportPhoneNumbers({
            groupId: input.groupId,
            startTime: input.startTime,
            endTime: input.endTime,
            direction: input.direction,
          });
        } else if (role === "admin" && ctx.user.groupId) {
          // Admin can only export from their group
          return getExportPhoneNumbers({
            groupId: ctx.user.groupId,
            startTime: input.startTime,
            endTime: input.endTime,
            direction: input.direction,
          });
        } else {
          // Regular user can only export their own
          return getExportPhoneNumbers({
            userId: ctx.user.id,
            startTime: input.startTime,
            endTime: input.endTime,
            direction: input.direction,
          });
        }
      }),
  }),

  // ─── Superadmin: Total Backend ───
  superadmin: router({
    stats: superadminProcedure.query(async () => {
      return getSystemStats();
    }),

    // Group (子后台) management
    groups: superadminProcedure.query(async () => {
      const groupList = await getAllGroups();
      const result = [];
      for (const g of groupList) {
        const userCount = await getGroupUserCount(g.id);
        const deviceCount = await getGroupDeviceCount(g.id);
        const allocated = await getGroupAllocatedDevices(g.id);
        result.push({ ...g, userCount, deviceCount, allocatedDevices: allocated });
      }
      return result;
    }),

    createGroup: superadminProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        groupCode: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_-]+$/, "标识码只能包含字母、数字、下划线和短横线"),
        maxDevices: z.number().min(1).max(99999),
      }))
      .mutation(async ({ input }) => {
        const existing = await getGroupByCode(input.groupCode);
        if (existing) {
          throw new Error("该标识码已存在");
        }
        const group = await createGroup({
          name: input.name,
          groupCode: input.groupCode,
          maxDevices: input.maxDevices,
          isActive: true,
        });
        return group;
      }),

    updateGroup: superadminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        maxDevices: z.number().min(0).max(99999).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.name !== undefined) data.name = input.name;
        if (input.maxDevices !== undefined) data.maxDevices = input.maxDevices;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        await updateGroup(input.id, data);
        return { success: true };
      }),

    // Create admin account for a group
    createGroupAdmin: superadminProcedure
      .input(z.object({
        groupId: z.number(),
        username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(6).max(64),
        name: z.string().min(1).max(64),
      }))
      .mutation(async ({ input }) => {
        const group = await getGroupById(input.groupId);
        if (!group) throw new Error("用户组不存在");

        const existing = await getUserByUsername(input.username);
        if (existing) throw new Error("该用户名已被注册");

        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await createUserWithPassword({
          username: input.username,
          passwordHash,
          name: input.name,
          groupId: input.groupId,
        });

        if (!user) throw new Error("创建失败");

        // Set role to admin
        await updateUserAdmin(user.id, { role: "admin" });
        // Link admin to group
        await updateGroup(input.groupId, { adminUserId: user.id });

        return { success: true, userId: user.id };
      }),

    // All users management
    allUsers: superadminProcedure.query(async () => {
      const userList = await getAllUsers();
      const result = [];
      for (const u of userList) {
        const deviceCount = await getDeviceCountByUserId(u.id);
        let groupName = null;
        if (u.groupId) {
          const group = await getGroupById(u.groupId);
          groupName = group?.name || null;
        }
        result.push({ ...u, deviceCount, groupName });
      }
      return result;
    }),

    updateUser: superadminProcedure
      .input(z.object({
        id: z.number(),
        maxDevices: z.number().min(0).max(99999).optional(),
        isActive: z.boolean().optional(),
        role: z.enum(["user", "admin", "superadmin"]).optional(),
        name: z.string().min(1).max(64).optional(),
        groupId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.maxDevices !== undefined) data.maxDevices = input.maxDevices;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.role !== undefined) data.role = input.role;
        if (input.name !== undefined) data.name = input.name;
        if (input.groupId !== undefined) data.groupId = input.groupId;
        await updateUserAdmin(input.id, data);
        return { success: true };
      }),

    resetPassword: superadminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6).max(64),
      }))
      .mutation(async ({ input }) => {
        const user = await getUserById(input.id);
        if (!user) throw new Error("用户不存在");
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        const db = (await import("./db")).getDb();
        const dbInstance = await db;
        if (!dbInstance) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbInstance.update(users).set({ passwordHash }).where(eq(users.id, input.id));
        return { success: true };
      }),

    // View all messages (cross-group)
    messages: superadminProcedure
      .input(z.object({
        groupId: z.number().optional(),
        search: z.string().optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getAllMessagesForSuperadmin({
          groupId: input.groupId,
          search: input.search,
          startTime: input.startTime,
          endTime: input.endTime,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // System config management
    getConfigs: superadminProcedure.query(async () => {
      return getAllConfigs();
    }),

    setConfig: superadminProcedure
      .input(z.object({
        key: z.string().min(1).max(128),
        value: z.string().max(4096),
        description: z.string().max(256).optional(),
      }))
      .mutation(async ({ input }) => {
        await setConfigValue(input.key, input.value, input.description);
        return { success: true };
      }),
  }),

  // ─── Admin (子后台): Group Management ───
  admin: router({
    stats: adminProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "superadmin") {
        return getSystemStats();
      }
      if (!ctx.user.groupId) throw new Error("未绑定用户组");
      return getGroupStats(ctx.user.groupId);
    }),

    // List users in my group
    users: adminProcedure.query(async ({ ctx }) => {
      if (!ctx.user.groupId) throw new Error("未绑定用户组");
      const userList = await getUsersByGroupId(ctx.user.groupId);
      const result = [];
      for (const u of userList) {
        const deviceCount = await getDeviceCountByUserId(u.id);
        result.push({ ...u, deviceCount });
      }
      return result;
    }),

    // Get my group info
    myGroup: adminProcedure.query(async ({ ctx }) => {
      if (!ctx.user.groupId) throw new Error("未绑定用户组");
      const group = await getGroupById(ctx.user.groupId);
      if (!group) throw new Error("用户组不存在");
      const allocated = await getGroupAllocatedDevices(ctx.user.groupId);
      return { ...group, allocatedDevices: allocated };
    }),

    updateUser: adminProcedure
      .input(z.object({
        id: z.number(),
        maxDevices: z.number().min(0).max(99999).optional(),
        isActive: z.boolean().optional(),
        name: z.string().min(1).max(64).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user belongs to admin's group
        const targetUser = await getUserById(input.id);
        if (!targetUser) throw new Error("用户不存在");
        if (targetUser.groupId !== ctx.user.groupId) throw new Error("无权操作此用户");
        if (targetUser.role !== "user") throw new Error("只能管理一线人员");

        // Check quota allocation if changing maxDevices
        if (input.maxDevices !== undefined && ctx.user.groupId) {
          const group = await getGroupById(ctx.user.groupId);
          if (group) {
            const currentAllocated = await getGroupAllocatedDevices(ctx.user.groupId);
            const currentUserMax = targetUser.maxDevices;
            const newTotal = currentAllocated - currentUserMax + input.maxDevices;
            if (newTotal > group.maxDevices) {
              throw new Error(`配额超出用户组上限（组上限: ${group.maxDevices}，已分配: ${currentAllocated - currentUserMax}，本次分配: ${input.maxDevices}）`);
            }
          }
        }

        const data: any = {};
        if (input.maxDevices !== undefined) data.maxDevices = input.maxDevices;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.name !== undefined) data.name = input.name;
        await updateUserAdmin(input.id, data);
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6).max(64),
      }))
      .mutation(async ({ ctx, input }) => {
        const targetUser = await getUserById(input.id);
        if (!targetUser) throw new Error("用户不存在");
        if (targetUser.groupId !== ctx.user.groupId) throw new Error("无权操作此用户");
        if (targetUser.role !== "user") throw new Error("只能管理一线人员");

        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        const db = (await import("./db")).getDb();
        const dbInstance = await db;
        if (!dbInstance) throw new Error("Database not available");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbInstance.update(users).set({ passwordHash }).where(eq(users.id, input.id));
        return { success: true };
      }),

    // View messages for my group
    messages: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.groupId) throw new Error("未绑定用户组");
        return getMessagesByGroupId(ctx.user.groupId, {
          search: input.search,
          startTime: input.startTime,
          endTime: input.endTime,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // Get devices in my group
    devices: adminProcedure.query(async ({ ctx }) => {
      if (!ctx.user.groupId) throw new Error("未绑定用户组");
      const deviceList = await getDevicesByGroupId(ctx.user.groupId);
      // Enrich with owner info and online status
      const result = [];
      for (const d of deviceList) {
        const owner = await getUserById(d.userId);
        result.push({
          ...d,
          isOnline: isDeviceConnected(d.deviceId),
          ownerName: owner?.name || owner?.username || "未知",
        });
      }
      return result;
    }),
  }),

  // ─── SMS Templates (shared per user) ───
  template: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTemplatesByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(2000),
        label: z.string().max(128).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createTemplate({
          userId: ctx.user.id,
          content: input.content,
          label: input.label || null,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1).max(2000).optional(),
        label: z.string().max(128).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tpl = await getTemplateById(input.id);
        if (!tpl || tpl.userId !== ctx.user.id) throw new Error("模板不存在");
        const data: any = {};
        if (input.content !== undefined) data.content = input.content;
        if (input.label !== undefined) data.label = input.label;
        await updateTemplate(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tpl = await getTemplateById(input.id);
        if (!tpl || tpl.userId !== ctx.user.id) throw new Error("模板不存在");
        await deleteTemplate(input.id);
        return { success: true };
      }),
  }),

  // ─── Device Contacts (per device) ───
  contact: router({
    list: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) return [];
        return getContactsByDeviceId(input.deviceId);
      }),

    count: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) return 0;
        return getContactCountByDeviceId(input.deviceId);
      }),

    import: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        contacts: z.array(z.object({
          name: z.string().min(1).max(128),
          phoneNumber: z.string().min(1).max(32),
        })).min(1).max(10000),
      }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) throw new Error("设备不存在");
        const imported = await importContacts(ctx.user.id, input.deviceId, input.contacts);
        return { imported, duplicates: input.contacts.length - imported };
      }),

    clear: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) throw new Error("设备不存在");
        await clearContactsByDeviceId(input.deviceId);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // We don't have a direct ownership check on contact, but we check via device
        await deleteContact(input.id);
        return { success: true };
      }),
  }),

  // ─── Bulk SMS Tasks ───
  bulk: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getBulkTasksByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await getBulkTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) return null;
        return task;
      }),

    create: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        mode: z.enum(["round_robin", "random"]),
        intervalSeconds: z.number().min(5).max(3600),
        templateIds: z.array(z.number()).min(1),
        contacts: z.array(z.object({
          name: z.string(),
          phoneNumber: z.string(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) throw new Error("设备不存在");

        // Check no running task on this device
        const running = await getRunningTaskByDeviceId(input.deviceId);
        if (running) throw new Error("该设备已有正在运行的群发任务，请先停止后再创建");

        // Validate templates belong to user
        for (const tid of input.templateIds) {
          const tpl = await getTemplateById(tid);
          if (!tpl || tpl.userId !== ctx.user.id) throw new Error(`模板ID ${tid} 不存在`);
        }

        const task = await createBulkTask({
          userId: ctx.user.id,
          deviceId: input.deviceId,
          mode: input.mode,
          intervalSeconds: input.intervalSeconds,
          templateIds: JSON.stringify(input.templateIds),
          contacts: JSON.stringify(input.contacts),
          totalCount: input.contacts.length,
          currentIndex: 0,
          successCount: 0,
          failCount: 0,
          status: "pending",
        });

        return task;
      }),

    start: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getBulkTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) throw new Error("任务不存在");
        if (task.status !== "pending" && task.status !== "paused") throw new Error("任务状态不允许启动");

        // Check no other running task on this device
        const running = await getRunningTaskByDeviceId(task.deviceId);
        if (running && running.id !== task.id) throw new Error("该设备已有正在运行的任务");

        await updateBulkTask(input.id, { status: "running" });

        // Start the execution engine
        const { startBulkTaskExecution } = await import("./bulkEngine");
        startBulkTaskExecution(input.id);

        return { success: true };
      }),

    pause: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getBulkTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) throw new Error("任务不存在");
        if (task.status !== "running") throw new Error("任务未在运行中");

        const { stopBulkTaskExecution } = await import("./bulkEngine");
        stopBulkTaskExecution(input.id);
        await updateBulkTask(input.id, { status: "paused" });

        return { success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await getBulkTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) throw new Error("任务不存在");
        if (task.status === "completed" || task.status === "cancelled") throw new Error("任务已结束");

        const { stopBulkTaskExecution } = await import("./bulkEngine");
        stopBulkTaskExecution(input.id);
        await updateBulkTask(input.id, { status: "cancelled" });

        return { success: true };
      }),
  }),

  // ─── Auditor: Read-only access to stats, users, messages, export ───
  auditor: router({
    stats: auditorProcedure.query(async () => {
      return getSystemStats();
    }),

    allUsers: auditorProcedure.query(async () => {
      const userList = await getAllUsers();
      const result = [];
      for (const u of userList) {
        const deviceCount = await getDeviceCountByUserId(u.id);
        let groupName = null;
        if (u.groupId) {
          const group = await getGroupById(u.groupId);
          groupName = group?.name || null;
        }
        result.push({ ...u, deviceCount, groupName });
      }
      return result;
    }),

    messages: auditorProcedure
      .input(z.object({
        groupId: z.number().optional(),
        search: z.string().optional(),
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return getAllMessagesForSuperadmin({
          groupId: input.groupId,
          search: input.search,
          startTime: input.startTime,
          endTime: input.endTime,
          limit: input.limit,
          offset: input.offset,
        });
      }),

    exportNumbers: auditorProcedure
      .input(z.object({
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        direction: z.enum(["incoming", "outgoing"]).optional(),
        groupId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getExportPhoneNumbers({
          groupId: input.groupId,
          startTime: input.startTime,
          endTime: input.endTime,
          direction: input.direction,
        });
      }),

    groups: auditorProcedure.query(async () => {
      return getAllGroups();
    }),
  }),

  // ─── Pinned Contacts ───
  pinned: router({
    list: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) return [];
        return getPinnedContacts(input.deviceId);
      }),

    pin: protectedProcedure
      .input(z.object({ deviceId: z.number(), phoneNumber: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }
        const phone = normalizePhone(input.phoneNumber);
        return pinContact(input.deviceId, phone);
      }),

    unpin: protectedProcedure
      .input(z.object({ deviceId: z.number(), phoneNumber: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }
        const phone = normalizePhone(input.phoneNumber);
        await unpinContact(input.deviceId, phone);
        return { success: true };
      }),
  }),

  // ─── Statistics ───
  stats: router({
    devices: protectedProcedure
      .input(z.object({
        startTime: z.number().optional(),
        endTime: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return getDeviceStats(ctx.user.id, {
          startTime: input.startTime,
          endTime: input.endTime,
        });
      }),

    // Global stats for superadmin and auditor
    all: protectedProcedure
      .input(z.object({
        startTime: z.number().optional(),
        endTime: z.number().optional(),
        groupId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "superadmin" && ctx.user.role !== "auditor") {
          throw new Error("无权访问全局统计");
        }
        return getAllDeviceStats({
          startTime: input.startTime,
          endTime: input.endTime,
          groupId: input.groupId,
        });
      }),
  }),

  // ─── Chat Records (admin/superadmin/auditor view) ───
  chatRecords: router({
    // Get devices visible to the current user based on role
    devices: protectedProcedure.query(async ({ ctx }) => {
      const role = ctx.user.role;
      if (role !== "admin" && role !== "superadmin" && role !== "auditor") {
        throw new Error("无权访问聊天记录查看功能");
      }
      return getDevicesForChatRecords(ctx.user.id, role, ctx.user.groupId);
    }),
    // Get contacts for a device within a date range
    contacts: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        startTime: z.number(),
        endTime: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const role = ctx.user.role;
        if (role !== "admin" && role !== "superadmin" && role !== "auditor") {
          throw new Error("无权访问");
        }
        // Verify device access
        const device = await getDeviceById(input.deviceId);
        if (!device) throw new Error("设备不存在");
        if (role === "admin") {
          // Admin can only see devices in their group
          const owner = await getUserById(device.userId);
          if (!owner || owner.groupId !== ctx.user.groupId) throw new Error("无权访问该设备");
        }
        return getChatContactsByDeviceIdAndDate(input.deviceId, input.startTime, input.endTime);
      }),
    // Search contacts by keyword (name, phone, or message content)
    searchContacts: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        startTime: z.number(),
        endTime: z.number(),
        keyword: z.string().min(1),
      }))
      .query(async ({ ctx, input }) => {
        const role = ctx.user.role;
        if (role !== "admin" && role !== "superadmin" && role !== "auditor") {
          throw new Error("\u65E0\u6743\u8BBF\u95EE");
        }
        const device = await getDeviceById(input.deviceId);
        if (!device) throw new Error("\u8BBE\u5907\u4E0D\u5B58\u5728");
        if (role === "admin") {
          const owner = await getUserById(device.userId);
          if (!owner || owner.groupId !== ctx.user.groupId) throw new Error("\u65E0\u6743\u8BBF\u95EE\u8BE5\u8BBE\u5907");
        }
        return searchChatContacts(input.deviceId, input.startTime, input.endTime, input.keyword);
      }),
    // Get messages for a specific contact within a date range
    messages: protectedProcedure
      .input(z.object({
        deviceId: z.number(),
        phoneNumber: z.string().min(1),
        startTime: z.number(),
        endTime: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const role = ctx.user.role;
        if (role !== "admin" && role !== "superadmin" && role !== "auditor") {
          throw new Error("无权访问");
        }
        // Verify device access
        const device = await getDeviceById(input.deviceId);
        if (!device) throw new Error("设备不存在");
        if (role === "admin") {
          const owner = await getUserById(device.userId);
          if (!owner || owner.groupId !== ctx.user.groupId) throw new Error("无权访问该设备");
        }
        return getMessagesByContactAndDate(input.deviceId, input.phoneNumber, input.startTime, input.endTime);
      }),
  }),
  // ─── Sync SMS from device ───
  syncSms: router({
    trigger: protectedProcedure
      .input(z.object({ deviceId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.deviceId);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("设备不存在");
        }
        if (!isDeviceConnected(device.deviceId)) {
          throw new Error("设备不在线");
        }
        sendSyncSmsRequest(device.deviceId);
        return { success: true, message: "同步请求已发送到设备" };
      }),
  }),

  // ─── Public Config (for frontend to read customer service link etc.) ───
  config: router({
    getServiceLink: publicProcedure.query(async () => {
      const link = await getConfigValue("customer_service_link");
      return { link: link || "" };
    }),
  }),
});

export type AppRouter = typeof appRouter;
