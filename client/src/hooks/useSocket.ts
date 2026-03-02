import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const HEARTBEAT_INTERVAL = 30000; // 30秒发送一次心跳
const MAX_RECONNECT_ATTEMPTS = 50; // 最大重连次数
const RECONNECT_DELAY_BASE = 1000; // 基础重连延迟 1秒
const RECONNECT_DELAY_MAX = 30000; // 最大重连延迟 30秒

export function useDashboardSocket(userId: number | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io("/dashboard", {
      path: "/api/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY_BASE,
      reconnectionDelayMax: RECONNECT_DELAY_MAX,
      timeout: 20000,
    });

    socketRef.current = socket;

    // 启动心跳
    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit("heartbeat");
        }
      }, HEARTBEAT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      socket.emit("register", { userId });
      startHeartbeat();
      console.log("[Dashboard WS] Connected");
    });

    socket.on("registered", () => {
      console.log("[Dashboard WS] Registered successfully");
    });

    socket.on("heartbeat_ack", () => {
      // 心跳确认，连接正常
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      stopHeartbeat();
      console.log(`[Dashboard WS] Disconnected: ${reason}`);
      // 如果是服务端主动断开，socket.io 会自动重连
    });

    socket.on("reconnect_attempt", (attempt) => {
      setReconnectAttempt(attempt);
      console.log(`[Dashboard WS] Reconnecting... attempt ${attempt}`);
    });

    socket.on("reconnect", () => {
      console.log("[Dashboard WS] Reconnected successfully");
      setReconnectAttempt(0);
    });

    socket.on("reconnect_failed", () => {
      console.error("[Dashboard WS] Reconnection failed after max attempts");
    });

    // Register all existing listeners
    const events = [
      "device_paired",
      "device_online",
      "device_offline",
      "device_status",
      "new_sms",
      "sms_status_update",
      "bulk_progress",
    ];

    events.forEach((event) => {
      socket.on(event, (data: any) => {
        const handlers = listenersRef.current.get(event);
        if (handlers) {
          handlers.forEach((handler) => handler(data));
        }
      });
    });

    return () => {
      stopHeartbeat();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  // 手动重连
  const reconnect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  return { isConnected, on, reconnectAttempt, reconnect };
}
