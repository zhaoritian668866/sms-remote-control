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
  getDevicesByUserId,
  getUserById,
  updateDevice,
} from "./db";
import { notifyOwner } from "./_core/notification";

// Track connected devices and dashboard clients
const connectedDevices = new Map<string, Socket>(); // deviceId -> socket
const dashboardClients = new Map<string, Socket>(); // sessionId -> socket
const pendingSmsSends = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();

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

        // Check user's device quota and existing devices
        const existingDevices = await getDevicesByUserId(tokenRecord.userId);
        const user = await getUserById(tokenRecord.userId);
        const maxDevices = user?.maxDevices ?? 1;
        let device;
        let deviceId: string;

        if (existingDevices.length < maxDevices) {
          // User has quota remaining - create a new device (support multiple messengers)
          deviceId = `dev_${nanoid(16)}`;
          device = await createDevice({
            userId: tokenRecord.userId,
            deviceId,
            name: data.deviceInfo?.phoneModel || `Phone ${deviceId.slice(-6)}`,
            phoneModel: data.deviceInfo?.phoneModel || null,
            androidVersion: data.deviceInfo?.androidVersion || null,
            phoneNumber: data.deviceInfo?.phoneNumber || null,
            isOnline: true,
            batteryLevel: data.deviceInfo?.batteryLevel || null,
            signalStrength: data.deviceInfo?.signalStrength || null,
            lastSeen: new Date(),
          });
          console.log(`[WS] Created new device id=${device.id}, deviceId=${deviceId} (${existingDevices.length + 1}/${maxDevices})`);
        } else if (existingDevices.length > 0) {
          // Device quota full - reuse the oldest device to preserve history
          // Sort by lastSeen ascending, reuse the one that's been offline longest
          const sorted = [...existingDevices].sort((a, b) => {
            const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
            const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
            return aTime - bTime;
          });
          const existing = sorted[0];
          deviceId = `dev_${nanoid(16)}`;
          await updateDevice(existing.id, {
            deviceId,
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
          console.log(`[WS] Quota full (${maxDevices}/${maxDevices}), re-paired oldest device id=${existing.id}, new deviceId=${deviceId}`);
        } else {
          // Edge case: maxDevices is 0, shouldn't happen but handle gracefully
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
    socket.on("sms_received", async (data: { phoneNumber: string; contactName?: string; body: string; timestamp: number; messageType?: string; imageUrl?: string }) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;

      try {
        const device = await getDeviceByDeviceId(deviceId);
        if (!device) return;

        const msg = await createMessage({
          deviceId: device.id,
          direction: "incoming",
          phoneNumber: data.phoneNumber,
          contactName: data.contactName || null,
          body: data.body || (data.messageType === "image" ? "[图片]" : ""),
          messageType: (data.messageType as "text" | "image") || "text",
          imageUrl: data.imageUrl || null,
          status: "received",
          smsTimestamp: data.timestamp,
        });

        broadcastToDashboard(device.userId, "new_sms", {
          message: msg,
          deviceId,
          deviceName: device.name,
        });

        // Notify owner about new SMS
        try {
          await notifyOwner({
            title: `📱 新短信 - ${device.name}`,
            content: `来自 ${data.contactName || data.phoneNumber} 的短信:\n${data.body}`,
          });
        } catch (e) {
          console.warn("[WS] Failed to notify owner:", e);
        }
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

// Get connected device count for a user
export function getConnectedDeviceIds(): string[] {
  return Array.from(connectedDevices.keys());
}
