import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { MqttClient } from "mqtt";

const HEARTBEAT_INTERVAL = 30000; // 30s heartbeat
const RECONNECT_PERIOD = 3000;    // 3s between reconnect attempts

export function useDashboardSocket(userId: number | undefined) {
  const mqttRef = useRef<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Dispatch event to registered listeners ───
  const dispatchEvent = useCallback((event: string, data: any) => {
    const handlers = listenersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }, []);

  // ─── Cleanup ───
  const cleanup = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (mqttRef.current) {
      try { mqttRef.current.end(true); } catch {}
      mqttRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // ─── MQTT connection ───
  useEffect(() => {
    if (!userId) return;

    // Build MQTT WebSocket URL
    const loc = window.location;
    const wsProtocol = loc.protocol === "https:" ? "wss" : "ws";
    const mqttUrl = `${wsProtocol}://${loc.host}/api/mqtt`;
    const clientId = `dashboard_${userId}_${Date.now()}`;

    console.log(`[Dashboard MQTT] Connecting to ${mqttUrl}...`);

    let client: MqttClient;
    try {
      client = mqtt.connect(mqttUrl, {
        clientId,
        clean: true,        // Use clean session to avoid stale state
        keepalive: 60,       // 60s keepalive (server-side Aedes default)
        reconnectPeriod: RECONNECT_PERIOD,
        connectTimeout: 10000,
        protocolVersion: 4,
      });
    } catch (err: any) {
      console.error("[Dashboard MQTT] Connect failed:", err?.message);
      return;
    }

    mqttRef.current = client;

    client.on("connect", () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      console.log("[Dashboard MQTT] Connected");

      // Subscribe to dashboard events topic
      const eventsTopic = `dashboard/${userId}/events`;
      client.subscribe(eventsTopic, { qos: 1 }, (err) => {
        if (err) {
          console.error("[Dashboard MQTT] Subscribe error:", err);
        } else {
          console.log(`[Dashboard MQTT] Subscribed to ${eventsTopic}`);
        }
      });

      // Send registration
      client.publish("dashboard/register", JSON.stringify({ userId }), { qos: 1 });

      // Start heartbeat
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      heartbeatTimerRef.current = setInterval(() => {
        if (client.connected) {
          client.publish("dashboard/heartbeat", JSON.stringify({ ts: Date.now() }), { qos: 0 });
        }
      }, HEARTBEAT_INTERVAL);
    });

    client.on("message", (_topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());

        // Dashboard events come as { event, data }
        if (payload.event && payload.data !== undefined) {
          dispatchEvent(payload.event, payload.data);
        }

        // Heartbeat ack
        if (payload.event === "heartbeat_ack") {
          // Connection is alive, nothing else to do
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    client.on("reconnect", () => {
      setReconnectAttempt((prev) => prev + 1);
      console.log("[Dashboard MQTT] Reconnecting...");
    });

    client.on("close", () => {
      setIsConnected(false);
    });

    client.on("error", (err) => {
      console.warn("[Dashboard MQTT] Error:", err.message);
    });

    // ─── Page visibility & network handlers ───
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (mqttRef.current && !mqttRef.current.connected) {
          try { mqttRef.current.reconnect(); } catch {}
        }
      }
    };

    const handleOnline = () => {
      if (mqttRef.current && !mqttRef.current.connected) {
        try { mqttRef.current.reconnect(); } catch {}
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      cleanup();
    };
  }, [userId, cleanup, dispatchEvent]);

  // ─── Public API ───
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const reconnect = useCallback(() => {
    if (mqttRef.current && !mqttRef.current.connected) {
      try { mqttRef.current.reconnect(); } catch {}
    }
  }, []);

  return { isConnected, on, reconnectAttempt, reconnect, transport: "mqtt" as const };
}
