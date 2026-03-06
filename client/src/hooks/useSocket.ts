import { useEffect, useRef, useState, useCallback } from "react";
import mqtt, { MqttClient } from "mqtt";
import { io, Socket } from "socket.io-client";

const HEARTBEAT_INTERVAL = 30000; // 30s heartbeat (MQTT is lighter)
const HEARTBEAT_TIMEOUT = 15000;
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 15000;

type TransportType = "mqtt" | "socketio";

export function useDashboardSocket(userId: number | undefined) {
  const mqttRef = useRef<MqttClient | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [transport, setTransport] = useState<TransportType>("mqtt");
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  const fallbackAttemptedRef = useRef(false);

  // ─── Dispatch event to registered listeners ───
  const dispatchEvent = useCallback((event: string, data: any) => {
    const handlers = listenersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }, []);

  // ─── Heartbeat management ───
  const clearHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    clearHeartbeatTimeout();
  }, [clearHeartbeatTimeout]);

  // ─── Cleanup all connections ───
  const cleanupAll = useCallback(() => {
    stopHeartbeat();
    if (mqttRef.current) {
      try { mqttRef.current.end(true); } catch {}
      mqttRef.current = null;
    }
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }
    setIsConnected(false);
  }, [stopHeartbeat]);

  // ─── Start Socket.IO fallback ───
  const startSocketIO = useCallback((uid: number) => {
    if (socketRef.current) return;
    console.log("[Dashboard] Falling back to Socket.IO...");
    setTransport("socketio");

    const socket = io("/dashboard", {
      path: "/api/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: RECONNECT_DELAY_BASE,
      reconnectionDelayMax: RECONNECT_DELAY_MAX,
      timeout: 10000,
      forceNew: false,
      upgrade: true,
      rememberUpgrade: true,
    });

    socketRef.current = socket;

    const startHB = () => {
      stopHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit("heartbeat");
          clearHeartbeatTimeout();
          heartbeatTimeoutRef.current = setTimeout(() => {
            const elapsed = Date.now() - lastPongRef.current;
            if (elapsed > HEARTBEAT_TIMEOUT + HEARTBEAT_INTERVAL) {
              socket.disconnect();
              setTimeout(() => { if (!socket.connected) socket.connect(); }, 500);
            }
          }, HEARTBEAT_TIMEOUT);
        }
      }, HEARTBEAT_INTERVAL);
    };

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      lastPongRef.current = Date.now();
      socket.emit("register", { userId: uid });
      startHB();
      console.log("[Dashboard WS] Connected");
    });

    socket.on("registered", () => console.log("[Dashboard WS] Registered"));
    socket.on("heartbeat_ack", () => { lastPongRef.current = Date.now(); clearHeartbeatTimeout(); });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      stopHeartbeat();
      if (reason === "io server disconnect") {
        setTimeout(() => socket.connect(), RECONNECT_DELAY_BASE);
      }
    });

    socket.on("connect_error", () => setIsConnected(false));
    socket.on("reconnect_attempt", (attempt) => {
      setReconnectAttempt(attempt);
    });
    socket.on("reconnect", () => {
      setReconnectAttempt(0);
      lastPongRef.current = Date.now();
    });

    // Business events
    const events = ["device_paired", "device_online", "device_offline", "device_status", "new_sms", "sms_status_update", "bulk_progress", "sms_sync_progress", "device_log"];
    events.forEach((event) => {
      socket.on(event, (data: any) => dispatchEvent(event, data));
    });
  }, [stopHeartbeat, clearHeartbeatTimeout, dispatchEvent]);

  // ─── Start MQTT connection ───
  useEffect(() => {
    if (!userId) return;

    // Build MQTT WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const mqttUrl = `${protocol}//${window.location.host}/api/mqtt`;
    const clientId = `dashboard_${userId}_${Date.now()}`;

    console.log(`[Dashboard MQTT] Connecting to ${mqttUrl}...`);

    const client = mqtt.connect(mqttUrl, {
      clientId,
      clean: false, // Persistent session for offline message delivery
      keepalive: 60,
      reconnectPeriod: RECONNECT_DELAY_BASE,
      connectTimeout: 8000,
      protocolVersion: 4,
    });

    mqttRef.current = client;
    setTransport("mqtt");

    // MQTT connection timeout - fallback to Socket.IO
    const mqttTimeout = setTimeout(() => {
      if (!client.connected && !fallbackAttemptedRef.current) {
        console.warn("[Dashboard MQTT] Connection timeout, falling back to Socket.IO");
        fallbackAttemptedRef.current = true;
        try { client.end(true); } catch {}
        mqttRef.current = null;
        startSocketIO(userId);
      }
    }, 10000);

    client.on("connect", () => {
      clearTimeout(mqttTimeout);
      setIsConnected(true);
      setReconnectAttempt(0);
      lastPongRef.current = Date.now();
      setTransport("mqtt");
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

      // Subscribe to heartbeat ack
      client.subscribe("dashboard/heartbeat_ack", { qos: 0 });

      // Send registration
      client.publish("dashboard/register", JSON.stringify({ userId }), { qos: 1 });

      // Start heartbeat
      stopHeartbeat();
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
        if (payload.ts) {
          lastPongRef.current = Date.now();
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    client.on("reconnect", () => {
      setReconnectAttempt((prev) => prev + 1);
    });

    client.on("close", () => {
      setIsConnected(false);
    });

    client.on("error", (err) => {
      console.warn("[Dashboard MQTT] Error:", err.message);
      // If MQTT keeps failing, fall back to Socket.IO
      if (!fallbackAttemptedRef.current && !client.connected) {
        fallbackAttemptedRef.current = true;
        clearTimeout(mqttTimeout);
        try { client.end(true); } catch {}
        mqttRef.current = null;
        startSocketIO(userId);
      }
    });

    // ─── Page visibility & network handlers ───
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (mqttRef.current && !mqttRef.current.connected) {
          mqttRef.current.reconnect();
        } else if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    const handleOnline = () => {
      if (mqttRef.current && !mqttRef.current.connected) {
        mqttRef.current.reconnect();
      } else if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(mqttTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      cleanupAll();
      fallbackAttemptedRef.current = false;
    };
  }, [userId, startSocketIO, stopHeartbeat, cleanupAll, dispatchEvent]);

  // ─── Public API (same interface as before) ───
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
      mqttRef.current.reconnect();
    } else if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  return { isConnected, on, reconnectAttempt, reconnect, transport };
}
