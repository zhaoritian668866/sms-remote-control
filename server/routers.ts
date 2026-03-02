import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
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
} from "./db";
import { sendSmsToDevice, isDeviceConnected, broadcastToDashboard } from "./wsManager";

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
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserByUsername(input.username);
        if (existing) {
          throw new Error("该用户名已被注册");
        }

        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await createUserWithPassword({
          username: input.username,
          passwordHash,
          name: input.name,
        });

        if (!user) {
          throw new Error("注册失败，请稍后重试");
        }

        // Auto-login after registration
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
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

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
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
      // Check device quota
      const currentCount = await getDeviceCountByUserId(ctx.user.id);
      const maxDevices = ctx.user.maxDevices ?? 1;
      if (currentCount >= maxDevices) {
        throw new Error(`DEVICE_QUOTA_EXCEEDED:${maxDevices}`);
      }

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

        const msg = await createMessage({
          deviceId: input.deviceId,
          direction: "outgoing",
          phoneNumber: input.phoneNumber,
          body: input.body,
          status: "pending",
          smsTimestamp: Date.now(),
        });

        const result = await sendSmsToDevice(device.deviceId, input.phoneNumber, input.body);

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
  }),

  // ─── Admin Management ───
  admin: router({
    stats: adminProcedure.query(async () => {
      return getSystemStats();
    }),

    users: adminProcedure.query(async () => {
      const userList = await getAllUsers();
      // Get device count for each user
      const result = [];
      for (const u of userList) {
        const deviceCount = await getDeviceCountByUserId(u.id);
        result.push({ ...u, deviceCount });
      }
      return result;
    }),

    updateUser: adminProcedure
      .input(z.object({
        id: z.number(),
        maxDevices: z.number().min(0).max(999).optional(),
        isActive: z.boolean().optional(),
        role: z.enum(["user", "admin"]).optional(),
        name: z.string().min(1).max(64).optional(),
      }))
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.maxDevices !== undefined) data.maxDevices = input.maxDevices;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.role !== undefined) data.role = input.role;
        if (input.name !== undefined) data.name = input.name;
        await updateUserAdmin(input.id, data);
        return { success: true };
      }),

    resetPassword: adminProcedure
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

    // System config management
    getConfigs: adminProcedure.query(async () => {
      return getAllConfigs();
    }),

    setConfig: adminProcedure
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

  // ─── Public Config (for frontend to read customer service link etc.) ───
  config: router({
    getServiceLink: publicProcedure.query(async () => {
      const link = await getConfigValue("customer_service_link");
      return { link: link || "" };
    }),
  }),
});

export type AppRouter = typeof appRouter;
