/**
 * MQTT Broker (Aedes) + Message Handler
 * 
 * Replaces Socket.IO with MQTT for more stable mobile connections.
 * Uses WebSocket transport on the same HTTP server (path: /api/mqtt).
 * 
 * Topic structure:
 *   device/{deviceId}/up/sms_received     - Device reports incoming SMS
 *   device/{deviceId}/up/sms_send_result  - Device reports SMS send result
 *   device/{deviceId}/up/sms_batch_sync   - Device sends historical SMS batch
 *   device/{deviceId}/up/status_update    - Device reports battery/signal
 *   device/{deviceId}/up/device_log       - Device forwards logs
 *   device/{deviceId}/up/pair             - Device requests pairing
 *   device/{deviceId}/up/reconnect        - Device reconnects
 *   device/{deviceId}/up/heartbeat        - Device heartbeat
 *   device/{deviceId}/down/send_sms       - Server commands device to send SMS
 *   device/{deviceId}/down/send_mms       - Server commands device to send MMS
 *   device/{deviceId}/down/sync_sms       - Server requests SMS sync
 *   device/{deviceId}/down/pair_result    - Server sends pairing result
 *   device/{deviceId}/down/reconnect_result - Server sends reconnect result
 *   device/{deviceId}/down/heartbeat_ack  - Server heartbeat ack
 *   dashboard/{userId}/events             - Server pushes events to dashboard
 */

import { Server as HttpServer } from "http";
import { Aedes } from "aedes";
// @ts-ignore
import wsStream from "websocket-stream";
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
  getMessageByDedup,
} from "./db";
import { notifyOwner } from "./_core/notification";

// ─── State tracking ───
const connectedDevices = new Map<string, string>(); // deviceId -> clientId
const deviceClientMap = new Map<string, string>();   // clientId -> deviceId
const dashboardClients = new Map<string, number>();  // clientId -> userId
const pendingSmsSends = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>();

let broker: any;

export async function initMqttBroker(server: HttpServer) {
  broker = await (Aedes as any).createBroker();

  // Use websocket-stream to attach MQTT over WebSocket to the HTTP server
  (wsStream as any).createServer({ server, path: "/api/mqtt" }, broker.handle);

  console.log("[MQTT] Broker started on /api/mqtt (WebSocket)");

  // ─── Client connected ───
  broker.on("client", (client: any) => {
    console.log(`[MQTT] Client connected: ${client.id}`);
  });

  // ─── Client disconnected ───
  broker.on("clientDisconnect", async (client: any) => {
    const clientId = client.id;
    console.log(`[MQTT] Client disconnected: ${clientId}`);

    // Handle device disconnect
    const deviceId = deviceClientMap.get(clientId);
    if (deviceId) {
      connectedDevices.delete(deviceId);
      deviceClientMap.delete(clientId);
      try {
        await setDeviceOnline(deviceId, false);
        const device = await getDeviceByDeviceId(deviceId);
        if (device) {
          publishToDashboard(device.userId, "device_offline", { deviceId });
        }
      } catch (err) {
        console.error("[MQTT] disconnect cleanup error:", err);
      }
    }

    // Handle dashboard disconnect
    dashboardClients.delete(clientId);
  });

  // ─── Message routing ───
  broker.on("publish", async (packet: any, client: any) => {
    if (!client) return; // System messages (retained, etc.)

    const topic = packet.topic;
    let payload: any;
    try {
      payload = JSON.parse(packet.payload.toString());
    } catch {
      return; // Ignore non-JSON messages
    }

    // ─── Device uplink messages ───
    const deviceUpMatch = topic.match(/^device\/([^/]+)\/up\/(.+)$/);
    if (deviceUpMatch) {
      const [, topicDeviceId, action] = deviceUpMatch;
      await handleDeviceMessage(client.id, topicDeviceId, action, payload);
      return;
    }

    // ─── Dashboard registration ───
    if (topic === "dashboard/register") {
      const userId = payload.userId;
      if (userId) {
        dashboardClients.set(client.id, userId);
        // Subscribe this client to their dashboard topic
        publishToClient(client.id, "dashboard/registered", { success: true });
        console.log(`[MQTT] Dashboard registered: clientId=${client.id}, userId=${userId}`);
      }
      return;
    }

    // ─── Dashboard heartbeat ───
    if (topic === "dashboard/heartbeat") {
      publishToClient(client.id, "dashboard/heartbeat_ack", { ts: Date.now() });
      return;
    }
  });

  return broker;
}

// ─── Device message handler ───
async function handleDeviceMessage(clientId: string, topicDeviceId: string, action: string, data: any) {
  switch (action) {
    case "pair":
      await handlePair(clientId, topicDeviceId, data);
      break;
    case "reconnect":
      await handleReconnect(clientId, topicDeviceId, data);
      break;
    case "heartbeat":
      handleHeartbeat(clientId, topicDeviceId);
      break;
    case "sms_received":
      await handleSmsReceived(clientId, data);
      break;
    case "sms_send_result":
      handleSmsSendResult(data);
      break;
    case "sms_batch_sync":
      await handleSmsBatchSync(clientId, data);
      break;
    case "status_update":
      await handleStatusUpdate(clientId, data);
      break;
    case "device_log":
      await handleDeviceLog(clientId, data);
      break;
    default:
      console.log(`[MQTT] Unknown device action: ${action}`);
  }
}

// ─── Pairing ───
async function handlePair(clientId: string, tempDeviceId: string, data: { token: string; deviceInfo: any }) {
  try {
    const tokenRecord = await getPairingTokenByToken(data.token);
    if (!tokenRecord) {
      publishToClient(clientId, `device/${tempDeviceId}/down/pair_result`, { success: false, error: "Invalid token" });
      return;
    }
    if (tokenRecord.status !== "pending") {
      publishToClient(clientId, `device/${tempDeviceId}/down/pair_result`, { success: false, error: "Token already used or expired" });
      return;
    }
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      await updatePairingToken(tokenRecord.id, { status: "expired" });
      publishToClient(clientId, `device/${tempDeviceId}/down/pair_result`, { success: false, error: "Token expired" });
      return;
    }

    const existingDevices = await getDevicesByUserId(tokenRecord.userId);
    const user = await getUserById(tokenRecord.userId);
    const maxDevices = user?.maxDevices ?? 1;
    let device;
    let deviceId: string;

    if (existingDevices.length < maxDevices) {
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
      console.log(`[MQTT] Created new device id=${device.id}, deviceId=${deviceId} (${existingDevices.length + 1}/${maxDevices})`);
    } else if (existingDevices.length > 0) {
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
      console.log(`[MQTT] Quota full (${maxDevices}/${maxDevices}), re-paired oldest device id=${existing.id}, new deviceId=${deviceId}`);
    } else {
      publishToClient(clientId, `device/${tempDeviceId}/down/pair_result`, { success: false, error: "No device quota available" });
      return;
    }

    await updatePairingToken(tokenRecord.id, { status: "paired", deviceId: device.id });

    // Register device
    connectedDevices.set(deviceId, clientId);
    deviceClientMap.set(clientId, deviceId);

    publishToClient(clientId, `device/${deviceId}/down/pair_result`, { success: true, deviceId });

    publishToDashboard(tokenRecord.userId, "device_paired", { device });
  } catch (err: any) {
    console.error("[MQTT] Pair error:", err);
    publishToClient(clientId, `device/${tempDeviceId}/down/pair_result`, { success: false, error: err.message });
  }
}

// ─── Reconnect ───
async function handleReconnect(clientId: string, topicDeviceId: string, data: { deviceId: string }) {
  try {
    const deviceId = data.deviceId || topicDeviceId;
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) {
      publishToClient(clientId, `device/${deviceId}/down/reconnect_result`, { success: false, error: "Device not found" });
      return;
    }

    // Clean up old connection if exists
    const oldClientId = connectedDevices.get(deviceId);
    if (oldClientId && oldClientId !== clientId) {
      deviceClientMap.delete(oldClientId);
    }

    connectedDevices.set(deviceId, clientId);
    deviceClientMap.set(clientId, deviceId);

    await setDeviceOnline(deviceId, true);

    publishToClient(clientId, `device/${deviceId}/down/reconnect_result`, { success: true });

    publishToDashboard(device.userId, "device_online", { deviceId });
  } catch (err: any) {
    console.error("[MQTT] Reconnect error:", err);
    publishToClient(clientId, `device/${topicDeviceId}/down/reconnect_result`, { success: false, error: err.message });
  }
}

// ─── Heartbeat ───
function handleHeartbeat(clientId: string, topicDeviceId: string) {
  const deviceId = deviceClientMap.get(clientId) || topicDeviceId;
  publishToClient(clientId, `device/${deviceId}/down/heartbeat_ack`, { ts: Date.now() });
  if (deviceId) {
    setDeviceOnline(deviceId, true).catch(() => {});
  }
}

// ─── SMS Received (with dedup) ───
async function handleSmsReceived(clientId: string, data: { phoneNumber: string; contactName?: string; body: string; timestamp: number; messageType?: string; imageUrl?: string }) {
  const deviceId = deviceClientMap.get(clientId);
  if (!deviceId) return;

  try {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return;

    // Dedup: check if message with same deviceId + phoneNumber + timestamp already exists
    const existing = await getMessageByDedup(device.id, data.phoneNumber, data.timestamp);
    if (existing) {
      console.log(`[MQTT] Duplicate SMS skipped: device=${deviceId}, phone=${data.phoneNumber}, ts=${data.timestamp}`);
      return;
    }

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

    publishToDashboard(device.userId, "new_sms", {
      message: msg,
      deviceId,
      deviceName: device.name,
    });

    // Notify owner (optional, self-hosted may not have this)
    if (process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY) {
      try {
        await notifyOwner({
          title: `📱 新短信 - ${device.name}`,
          content: `来自 ${data.contactName || data.phoneNumber} 的短信:\n${data.body}`,
        });
      } catch (e) {
        // Silently ignore
      }
    }
  } catch (err) {
    console.error("[MQTT] sms_received error:", err);
  }
}

// ─── SMS Send Result ───
function handleSmsSendResult(data: { requestId: string; success: boolean; error?: string }) {
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
}

// ─── SMS Batch Sync (with dedup) ───
async function handleSmsBatchSync(clientId: string, data: { messages: any[] }) {
  const deviceId = deviceClientMap.get(clientId);
  if (!deviceId) return;

  try {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return;
    const msgCount = data.messages?.length || 0;
    console.log(`[MQTT] Received SMS batch sync: ${msgCount} messages from device ${deviceId}`);

    let imported = 0;
    let skipped = 0;
    for (const msg of (data.messages || [])) {
      try {
        if (!msg.phoneNumber || msg.phoneNumber.trim() === "") {
          skipped++;
          continue;
        }
        // Dedup check
        const existing = await getMessageByDedup(device.id, msg.phoneNumber, msg.timestamp || 0);
        if (existing) {
          skipped++;
          continue;
        }
        await createMessage({
          deviceId: device.id,
          direction: msg.direction || "incoming",
          phoneNumber: msg.phoneNumber,
          contactName: msg.contactName || null,
          body: msg.body || "",
          messageType: msg.messageType || "text",
          status: "delivered",
          smsTimestamp: msg.timestamp || Date.now(),
        });
        imported++;
      } catch (e: any) {
        skipped++;
      }
    }
    console.log(`[MQTT] Batch sync done: imported=${imported}, skipped=${skipped}, total=${msgCount}`);

    publishToDashboard(device.userId, "sms_sync_progress", {
      deviceId,
      imported,
      total: msgCount,
    });
  } catch (err) {
    console.error("[MQTT] sms_batch_sync error:", err);
  }
}

// ─── Status Update ───
async function handleStatusUpdate(clientId: string, data: { batteryLevel?: number; signalStrength?: number }) {
  const deviceId = deviceClientMap.get(clientId);
  if (!deviceId) return;

  try {
    await updateDeviceStatus(deviceId, data);
    const device = await getDeviceByDeviceId(deviceId);
    if (device) {
      publishToDashboard(device.userId, "device_status", {
        deviceId,
        batteryLevel: data.batteryLevel,
        signalStrength: data.signalStrength,
      });
    }
  } catch (err) {
    console.error("[MQTT] status_update error:", err);
  }
}

// ─── Device Log ───
async function handleDeviceLog(clientId: string, data: { level: string; tag: string; message: string; timestamp?: number }) {
  const deviceId = deviceClientMap.get(clientId);
  if (!deviceId) return;

  try {
    const device = await getDeviceByDeviceId(deviceId);
    if (device) {
      publishToDashboard(device.userId, "device_log", {
        deviceId,
        deviceName: device.name,
        level: data.level || "info",
        tag: data.tag || "Device",
        message: data.message,
        timestamp: data.timestamp || Date.now(),
      });
    }
  } catch (err) {
    console.error("[MQTT] device_log error:", err);
  }
}

// ─── Publish helpers ───

/** Publish a message to a specific MQTT client by clientId */
function publishToClient(clientId: string, topic: string, data: any) {
  if (!broker) return;
  broker.publish({
    topic,
    payload: Buffer.from(JSON.stringify(data)),
    qos: 1,
    retain: false,
    cmd: "publish",
    dup: false,
  } as any, () => {});
}

/** Publish an event to all dashboard clients of a specific user */
export function publishToDashboard(userId: number, event: string, data: any) {
  if (!broker) return;
  const topic = `dashboard/${userId}/events`;
  const payload = JSON.stringify({ event, data });
  broker.publish({
    topic,
    payload: Buffer.from(payload),
    qos: 1,
    retain: false,
    cmd: "publish",
    dup: false,
  } as any, () => {});
}

// ─── Exported functions (same interface as wsManager) ───

/** Send SMS command to a device via MQTT */
export async function sendSmsToDevice(deviceId: string, phoneNumber: string, body: string): Promise<{ success: boolean; error?: string }> {
  const clientId = connectedDevices.get(deviceId);
  if (!clientId) {
    return { success: false, error: "Device not connected" };
  }

  const requestId = nanoid(12);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingSmsSends.delete(requestId);
      resolve({ success: false, error: "Send timeout (30s)" });
    }, 30000);

    pendingSmsSends.set(requestId, { resolve, reject: () => {}, timer });

    publishToClient(clientId, `device/${deviceId}/down/send_sms`, {
      requestId,
      phoneNumber,
      body,
    });
  });
}

/** Send MMS command to a device via MQTT */
export async function sendMmsToDevice(deviceId: string, phoneNumber: string, imageUrl: string, body?: string): Promise<{ success: boolean; error?: string }> {
  const clientId = connectedDevices.get(deviceId);
  if (!clientId) {
    return { success: false, error: "Device not connected" };
  }

  const requestId = nanoid(12);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingSmsSends.delete(requestId);
      resolve({ success: false, error: "MMS send timeout (60s)" });
    }, 60000);

    pendingSmsSends.set(requestId, { resolve, reject: () => {}, timer });

    publishToClient(clientId, `device/${deviceId}/down/send_mms`, {
      requestId,
      phoneNumber,
      imageUrl,
      body: body || "",
    });
  });
}

/** Check if a device is currently connected */
export function isDeviceConnected(deviceId: string): boolean {
  return connectedDevices.has(deviceId);
}

/** Alias for publishToDashboard to match wsManager interface */
export function broadcastToDashboard(userId: number, event: string, data: any) {
  publishToDashboard(userId, event, data);
}

/** Send sync SMS request to a device */
export function sendSyncSmsRequest(deviceId: string) {
  const clientId = connectedDevices.get(deviceId);
  if (clientId) {
    publishToClient(clientId, `device/${deviceId}/down/sync_sms`, {});
    console.log(`[MQTT] Sent sync_sms_request to device ${deviceId}`);
  }
}

/** Get connected device IDs */
export function getConnectedDeviceIds(): string[] {
  return Array.from(connectedDevices.keys());
}
