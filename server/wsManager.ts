import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";
import {
  getPairingTokenByToken,
  updatePairingToken,
  createDevice,
  setDeviceOnline,
  updateDeviceStatus,
  createMessage,
  getDeviceByDeviceId,
  getDeviceByHardwareId,
  getDevicesByUserId,
  getUserById,
  updateDevice,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { generateAiReply } from "./aiEngine";
import { triggerLearning } from "./learningScheduler";

// Track connected devices and dashboard clients
const connectedDevices = new Map<string, Socket>(); // deviceId -> socket
const dashboardClients = new Map<string, Socket>(); // sessionId -> socket
const pendingSmsSends = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();

// SMS send dedup: prevent sending the same SMS twice to the same device
// Key: "deviceId:phoneNumber:bodyHash" -> timestamp of last send
const recentSmsSends = new Map<string, number>();
const SMS_DEDUP_WINDOW = 10_000; // 10 seconds dedup window

let io: Server;

export function initWebSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/ws",
    transports: ["websocket", "polling"],
    pingInterval: 15000,  // 服务端每15秒发送ping
    pingTimeout: 10000,   // 10秒未收到pong则断开
    connectTimeout: 10000, // 连接超时
    allowUpgrades: true,
  });

  // ─── Device namespace (Android phones connect here) ───
  const deviceNs = io.of("/device");
  deviceNs.on("connection", (socket: Socket) => {
    console.log(`[WS] Device socket connected: ${socket.id}`);

    // 心跳保活：客户端发送 heartbeat，服务端回复 heartbeat_ack
    socket.on("heartbeat", () => {
      socket.emit("heartbeat_ack", { ts: Date.now() });
      const deviceId = socket.data.deviceId;
      if (deviceId) {
        setDeviceOnline(deviceId, true).catch(() => {});
      }
    });

    // Device pairing flow
    socket.on("pair", async (data: { token: string; deviceInfo: any }) => {
      try {
        const tokenRecord = await getPairingTokenByToken(data.token);
        if (!tokenRecord) {
          socket.emit("pair_result", { success: false, error: "Invalid token" });
          return;
        }
        if (tokenRecord.status !== "pending") {
          socket.emit("pair_result", { success: false, error: "Token already used or expired" });
          return;
        }
        if (new Date(tokenRecord.expiresAt) < new Date()) {
          await updatePairingToken(tokenRecord.id, { status: "expired" });
          socket.emit("pair_result", { success: false, error: "Token expired" });
          return;
        }

        const hardwareId = data.deviceInfo?.hardwareId || data.deviceInfo?.androidId || null;
        let device;
        let deviceId: string;

        // Step 1: Try to find existing device by hardware fingerprint (same physical phone)
        if (hardwareId) {
          const existingByHw = await getDeviceByHardwareId(tokenRecord.userId, hardwareId);
          if (existingByHw) {
            // Same phone reconnecting - reuse the old device record (preserves read status, pins, messages)
            deviceId = `dev_${nanoid(16)}`;
            await updateDevice(existingByHw.id, {
              deviceId,
              name: data.deviceInfo?.phoneModel || existingByHw.name,
              phoneModel: data.deviceInfo?.phoneModel || existingByHw.phoneModel,
              androidVersion: data.deviceInfo?.androidVersion || existingByHw.androidVersion,
              phoneNumber: data.deviceInfo?.phoneNumber || existingByHw.phoneNumber,
              isOnline: true,
              batteryLevel: data.deviceInfo?.batteryLevel || existingByHw.batteryLevel,
              signalStrength: data.deviceInfo?.signalStrength || existingByHw.signalStrength,
              lastSeen: new Date(),
            });
            device = { ...existingByHw, deviceId, isOnline: true };
            console.log(`[WS] Recognized same phone by hardwareId=${hardwareId}, reused device id=${existingByHw.id}, new deviceId=${deviceId}`);

            await updatePairingToken(tokenRecord.id, { status: "paired", deviceId: device.id });
            connectedDevices.set(deviceId, socket);
            socket.data.deviceId = deviceId;
            socket.data.userId = tokenRecord.userId;
            socket.emit("pair_result", { success: true, deviceId });
            broadcastToDashboard(tokenRecord.userId, "device_paired", { device });
            return;
          }
        }

        // Step 2: No hardware match - check quota and create/reuse device
        const existingDevices = await getDevicesByUserId(tokenRecord.userId);
        const user = await getUserById(tokenRecord.userId);
        const maxDevices = user?.maxDevices ?? 1;

        if (existingDevices.length < maxDevices) {
          // User has quota remaining - create a new device
          deviceId = `dev_${nanoid(16)}`;
          device = await createDevice({
            userId: tokenRecord.userId,
            deviceId,
            hardwareId,
            name: data.deviceInfo?.phoneModel || `Phone ${deviceId.slice(-6)}`,
            phoneModel: data.deviceInfo?.phoneModel || null,
            androidVersion: data.deviceInfo?.androidVersion || null,
            phoneNumber: data.deviceInfo?.phoneNumber || null,
            isOnline: true,
            batteryLevel: data.deviceInfo?.batteryLevel || null,
            signalStrength: data.deviceInfo?.signalStrength || null,
            lastSeen: new Date(),
          });
          console.log(`[WS] Created new device id=${device.id}, deviceId=${deviceId}, hardwareId=${hardwareId} (${existingDevices.length + 1}/${maxDevices})`);
        } else if (existingDevices.length > 0) {
          // Device quota full - reuse the oldest offline device
          const sorted = [...existingDevices].sort((a, b) => {
            const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
            const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
            return aTime - bTime;
          });
          const existing = sorted[0];
          deviceId = `dev_${nanoid(16)}`;
          await updateDevice(existing.id, {
            deviceId,
            hardwareId,
            name: data.deviceInfo?.phoneModel || existing.name,
            phoneModel: data.deviceInfo?.phoneModel || existing.phoneModel,
            androidVersion: data.deviceInfo?.androidVersion || existing.androidVersion,
            phoneNumber: data.deviceInfo?.phoneNumber || existing.phoneNumber,
            isOnline: true,
            batteryLevel: data.deviceInfo?.batteryLevel || existing.batteryLevel,
            signalStrength: data.deviceInfo?.signalStrength || existing.signalStrength,
            lastSeen: new Date(),
          });
          device = { ...existing, deviceId, isOnline: true };
          console.log(`[WS] Quota full (${maxDevices}/${maxDevices}), re-paired oldest device id=${existing.id}, new deviceId=${deviceId}, hardwareId=${hardwareId}`);
        } else {
          socket.emit("pair_result", { success: false, error: "No device quota available" });
          return;
        }

        await updatePairingToken(tokenRecord.id, { status: "paired", deviceId: device.id });

        // Register device socket
        connectedDevices.set(deviceId, socket);
        socket.data.deviceId = deviceId;
        socket.data.userId = tokenRecord.userId;

        socket.emit("pair_result", { success: true, deviceId });

        // Notify dashboard
        broadcastToDashboard(tokenRecord.userId, "device_paired", {
          device,
        });
      } catch (err: any) {
        console.error("[WS] Pair error:", err);
        socket.emit("pair_result", { success: false, error: err.message });
      }
    });

    // Device reconnection (already paired)
    socket.on("reconnect_device", async (data: { deviceId: string }) => {
      try {
        const device = await getDeviceByDeviceId(data.deviceId);
        if (!device) {
          socket.emit("reconnect_result", { success: false, error: "Device not found" });
          return;
        }

        connectedDevices.set(data.deviceId, socket);
        socket.data.deviceId = data.deviceId;
        socket.data.userId = device.userId;

        await setDeviceOnline(data.deviceId, true);

        socket.emit("reconnect_result", { success: true });

        broadcastToDashboard(device.userId, "device_online", {
          deviceId: data.deviceId,
        });
      } catch (err: any) {
        console.error("[WS] Reconnect error:", err);
        socket.emit("reconnect_result", { success: false, error: err.message });
      }
    });

    // Incoming SMS from device (supports text and image/MMS)
    socket.on("sms_received", async (data: { phoneNumber: string; contactName?: string; body: string; timestamp: number; messageType?: string; imageUrl?: string; direction?: string }) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;

      try {
        const device = await getDeviceByDeviceId(deviceId);
        if (!device) return;

        const msg = await createMessage({
          deviceId: device.id,
          direction: data.direction === "sent" ? "outgoing" : "incoming",
          phoneNumber: data.phoneNumber,
          contactName: data.contactName || null,
          body: data.body || (data.messageType === "image" ? "[图片]" : ""),
          messageType: (data.messageType as "text" | "image") || "text",
          imageUrl: data.imageUrl || null,
          status: data.direction === "sent" ? "sent" : "received",
          smsTimestamp: data.timestamp,
        });

        broadcastToDashboard(device.userId, "new_sms", {
          message: msg,
          deviceId,
          deviceName: device.name,
        });

        // Notify owner about new SMS (optional, may not be configured on self-hosted)
        if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
          try {
            await notifyOwner({
              title: `📱 新短信 - ${device.name}`,
              content: `来自 ${data.contactName || data.phoneNumber} 的短信:\n${data.body}`,
            });
          } catch (e) {
            // Silently ignore on self-hosted servers
          }
        }

        // AI Auto-Reply: only trigger for incoming messages with text content
        if ((data.direction !== "sent") && data.body && data.body.trim()) {
          try {
            const aiResult = await generateAiReply(
              device.id,
              data.phoneNumber,
              device.userId,
              data.body
            );
            if (aiResult.success && aiResult.reply) {
              console.log(`[AI] Auto-reply to ${data.phoneNumber} (round ${aiResult.round}): ${aiResult.reply.substring(0, 50)}...`);
              // Send the AI reply via the device
              const sendResult = await sendSmsToDevice(deviceId, data.phoneNumber, aiResult.reply);
              if (sendResult.success) {
                // Save the AI reply as an outgoing message
                const aiMsg = await createMessage({
                  deviceId: device.id,
                  direction: "outgoing",
                  phoneNumber: data.phoneNumber,
                  contactName: data.contactName || null,
                  body: aiResult.reply,
                  messageType: "text",
                  imageUrl: null,
                  status: "sent",
                  smsTimestamp: Date.now(),
                });
                broadcastToDashboard(device.userId, "new_sms", {
                  message: aiMsg,
                  deviceId,
                  deviceName: device.name,
                  isAiReply: true,
                });
                console.log(`[AI] Reply sent successfully to ${data.phoneNumber}`);
              } else {
                console.error(`[AI] Failed to send reply: ${sendResult.error}`);
              }
            }
          } catch (aiErr) {
            console.error("[AI] Auto-reply error:", aiErr);
          }
        }
        // Trigger AI learning when new messages come in (debounced)
        triggerLearning();
      } catch (err) {
        console.error("[WS] sms_received error:", err);
      }
    });

    // SMS send result from device
    socket.on("sms_send_result", (data: { requestId: string; success: boolean; error?: string }) => {
      const pending = pendingSmsSends.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingSmsSends.delete(data.requestId);
        if (data.success) {
          pending.resolve({ success: true });
        } else {
          pending.resolve({ success: false, error: data.error });
        }
      }
    });

    // SMS batch sync from device (historical SMS)
    socket.on("sms_batch_sync", async (data: { messages: any[] }) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;
      try {
        const device = await getDeviceByDeviceId(deviceId);
        if (!device) return;
        const msgCount = data.messages?.length || 0;
        console.log(`[WS] Received SMS batch sync: ${msgCount} messages from device ${deviceId}`);
        
        let imported = 0;
        let skipped = 0;
        for (const msg of (data.messages || [])) {
          try {
            // Skip messages with empty phone numbers
            if (!msg.phoneNumber || msg.phoneNumber.trim() === "") {
              skipped++;
              continue;
            }
            await createMessage({
              deviceId: device.id,
              direction: msg.direction || "incoming",
              phoneNumber: msg.phoneNumber,
              body: msg.body || "",
              messageType: msg.messageType || "text",
              status: "delivered",
              smsTimestamp: msg.timestamp || Date.now(),
            });
            imported++;
          } catch (e: any) {
            skipped++;
            // Skip duplicates or invalid messages
          }
        }
        console.log(`[WS] Batch sync done: imported=${imported}, skipped=${skipped}, total=${msgCount}`);
        
        broadcastToDashboard(device.userId, "sms_sync_progress", {
          deviceId,
          numericDeviceId: device.id,
          imported,
          total: msgCount,
        });
      } catch (err) {
        console.error("[WS] sms_batch_sync error:", err);
      }
    });

    // Device log forwarding (for debugging MMS etc.)
    socket.on("device_log", async (data: { level: string; tag: string; message: string; timestamp?: number }) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;
      try {
        const device = await getDeviceByDeviceId(deviceId);
        if (device) {
          broadcastToDashboard(device.userId, "device_log", {
            deviceId,
            deviceName: device.name,
            level: data.level || "info",
            tag: data.tag || "Device",
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          });
        }
      } catch (err) {
        console.error("[WS] device_log error:", err);
      }
    });

    // Device status update
    socket.on("status_update", async (data: { batteryLevel?: number; signalStrength?: number }) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;

      try {
        await updateDeviceStatus(deviceId, data);
        const device = await getDeviceByDeviceId(deviceId);
        if (device) {
          broadcastToDashboard(device.userId, "device_status", {
            deviceId,
            batteryLevel: data.batteryLevel,
            signalStrength: data.signalStrength,
          });
        }
      } catch (err) {
        console.error("[WS] status_update error:", err);
      }
    });

    // Device disconnect
    socket.on("disconnect", async () => {
      const deviceId = socket.data.deviceId;
      if (deviceId) {
        connectedDevices.delete(deviceId);
        try {
          await setDeviceOnline(deviceId, false);
          const device = await getDeviceByDeviceId(deviceId);
          if (device) {
            broadcastToDashboard(device.userId, "device_offline", { deviceId });
          }
        } catch (err) {
          console.error("[WS] disconnect cleanup error:", err);
        }
      }
      console.log(`[WS] Device socket disconnected: ${socket.id}`);
    });
  });

  // ─── Dashboard namespace (web control panel connects here) ───
  const dashboardNs = io.of("/dashboard");
  dashboardNs.on("connection", (socket: Socket) => {
    console.log(`[WS] Dashboard connected: ${socket.id}`);

    socket.on("register", (data: { userId: number }) => {
      socket.data.userId = data.userId;
      dashboardClients.set(socket.id, socket);
      socket.emit("registered", { success: true });
    });

    // Dashboard 心跳保活
    socket.on("heartbeat", () => {
      socket.emit("heartbeat_ack", { ts: Date.now() });
    });

    socket.on("disconnect", () => {
      dashboardClients.delete(socket.id);
      console.log(`[WS] Dashboard disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Send SMS command to a device
export async function sendSmsToDevice(deviceId: string, phoneNumber: string, body: string): Promise<{ success: boolean; error?: string }> {
  const socket = connectedDevices.get(deviceId);
  if (!socket) {
    return { success: false, error: "Device not connected" };
  }

  // Dedup: prevent sending the same SMS content to the same number within 10 seconds
  const dedupKey = `${deviceId}:${phoneNumber}:${body}`;
  const lastSendTime = recentSmsSends.get(dedupKey);
  const now = Date.now();
  if (lastSendTime && now - lastSendTime < SMS_DEDUP_WINDOW) {
    console.log(`[WS] Duplicate SMS send blocked: ${phoneNumber} (within ${SMS_DEDUP_WINDOW/1000}s window)`);
    return { success: true }; // Return success to avoid error on frontend, but don't actually send
  }
  recentSmsSends.set(dedupKey, now);
  // Clean up old entries periodically
  if (recentSmsSends.size > 500) {
    const keysToDelete: string[] = [];
    recentSmsSends.forEach((ts, key) => {
      if (now - ts > SMS_DEDUP_WINDOW) keysToDelete.push(key);
    });
    keysToDelete.forEach(k => recentSmsSends.delete(k));
  }

  const requestId = nanoid(12);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingSmsSends.delete(requestId);
      resolve({ success: false, error: "Send timeout (30s)" });
    }, 30000);

    pendingSmsSends.set(requestId, { resolve, reject: () => {}, timer });

    socket.emit("send_sms", {
      requestId,
      phoneNumber,
      body,
    });
  });
}

// Send MMS (image) command to a device
export async function sendMmsToDevice(deviceId: string, phoneNumber: string, imageUrl: string, body?: string): Promise<{ success: boolean; error?: string }> {
  const socket = connectedDevices.get(deviceId);
  if (!socket) {
    return { success: false, error: "Device not connected" };
  }

  const requestId = nanoid(12);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingSmsSends.delete(requestId);
      resolve({ success: false, error: "MMS send timeout (60s)" });
    }, 60000);

    pendingSmsSends.set(requestId, { resolve, reject: () => {}, timer });

    socket.emit("send_mms", {
      requestId,
      phoneNumber,
      imageUrl,
      body: body || "",
    });
  });
}

// Check if a device is currently connected
export function isDeviceConnected(deviceId: string): boolean {
  return connectedDevices.has(deviceId);
}

// Broadcast to all dashboard clients of a specific user
export function broadcastToDashboard(userId: number, event: string, data: any) {
  dashboardClients.forEach((socket) => {
    if (socket.data.userId === userId) {
      socket.emit(event, data);
    }
  });
}

// Send sync SMS request to a device
export function sendSyncSmsRequest(deviceId: string) {
  const socket = connectedDevices.get(deviceId);
  if (socket) {
    socket.emit("sync_sms_request");
    console.log(`[WS] Sent sync_sms_request to device ${deviceId}`);
  }
}

// Get connected device count for a user
export function getConnectedDeviceIds(): string[] {
  return Array.from(connectedDevices.keys());
}

// Kick a device by disconnecting its WebSocket
export function kickDevice(deviceId: string): boolean {
  const socket = connectedDevices.get(deviceId);
  if (socket) {
    socket.emit("force_disconnect", { reason: "kicked_by_admin" });
    socket.disconnect(true);
    connectedDevices.delete(deviceId);
    console.log(`[WS] Device ${deviceId} kicked by admin`);
    return true;
  }
  return false;
}

// Kick all dashboard sessions for a specific user
export function kickDashboardSessions(userId: number): number {
  let count = 0;
  dashboardClients.forEach((socket, socketId) => {
    if (socket.data.userId === userId) {
      socket.emit("force_disconnect", { reason: "kicked_by_admin" });
      socket.disconnect(true);
      dashboardClients.delete(socketId);
      count++;
    }
  });
  console.log(`[WS] Kicked ${count} dashboard sessions for user ${userId}`);
  return count;
}

// Get all online device IDs with their socket data
export function getOnlineDeviceDetails(): Array<{ deviceId: string; socketId: string }> {
  const result: Array<{ deviceId: string; socketId: string }> = [];
  connectedDevices.forEach((socket, deviceId) => {
    result.push({ deviceId, socketId: socket.id });
  });
  return result;
}
