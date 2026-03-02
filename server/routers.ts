import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import {
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
} from "./db";
import { sendSmsToDevice, isDeviceConnected, broadcastToDashboard } from "./wsManager";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
          throw new Error("Device not found");
        }
        await updateDevice(input.id, { name: input.name });
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const device = await getDeviceById(input.id);
        if (!device || device.userId !== ctx.user.id) {
          throw new Error("Device not found");
        }
        await deleteDevice(input.id);
        return { success: true };
      }),
  }),

  // ─── Pairing ───
  pairing: router({
    generate: protectedProcedure.mutation(async ({ ctx }) => {
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
          throw new Error("Device not found");
        }

        // Save outgoing message as pending
        const msg = await createMessage({
          deviceId: input.deviceId,
          direction: "outgoing",
          phoneNumber: input.phoneNumber,
          body: input.body,
          status: "pending",
          smsTimestamp: Date.now(),
        });

        // Send to device via WebSocket
        const result = await sendSmsToDevice(device.deviceId, input.phoneNumber, input.body);

        // Update message status based on result
        const newStatus = result.success ? "sent" : "failed";
        await updateMessageStatus(msg.id, newStatus);

        // Broadcast status update to dashboard so UI updates in real-time
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
});

export type AppRouter = typeof appRouter;
