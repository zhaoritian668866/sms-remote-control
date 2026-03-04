import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const HEARTBEAT_INTERVAL = 15000; // 15秒发送一次心跳（与服务端 pingInterval 对齐）
const HEARTBEAT_TIMEOUT = 10000;  // 10秒未收到心跳回复视为连接异常
const MAX_RECONNECT_ATTEMPTS = Infinity; // 无限重连
const RECONNECT_DELAY_BASE = 1000; // 基础重连延迟 1秒
const RECONNECT_DELAY_MAX = 15000; // 最大重连延迟 15秒（从30秒缩短）

export function useDashboardSocket(userId: number | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPongRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!userId) return;

    const socket = io("/dashboard", {
      path: "/api/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY_BASE,
      reconnectionDelayMax: RECONNECT_DELAY_MAX,
      timeout: 10000,
      forceNew: false,
      // 自动升级到 websocket
      upgrade: true,
      rememberUpgrade: true,
    });

    socketRef.current = socket;

    // ─── 心跳管理 ───
    const clearHeartbeatTimeout = () => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit("heartbeat");
          // 设置心跳超时检测
          clearHeartbeatTimeout();
          heartbeatTimeoutRef.current = setTimeout(() => {
            const elapsed = Date.now() - lastPongRef.current;
            if (elapsed > HEARTBEAT_TIMEOUT + HEARTBEAT_INTERVAL) {
              console.warn("[Dashboard WS] Heartbeat timeout, forcing reconnect...");
              socket.disconnect();
              // socket.io 会自动重连
              setTimeout(() => {
                if (!socket.connected) {
                  socket.connect();
                }
              }, 500);
            }
          }, HEARTBEAT_TIMEOUT);
        }
      }, HEARTBEAT_INTERVAL);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      clearHeartbeatTimeout();
    };

    // ─── 连接事件 ───
    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      lastPongRef.current = Date.now();
      // 每次连接/重连都重新注册
      socket.emit("register", { userId });
      startHeartbeat();
      console.log("[Dashboard WS] Connected");
    });

    socket.on("registered", () => {
      console.log("[Dashboard WS] Registered successfully");
    });

    socket.on("heartbeat_ack", () => {
      lastPongRef.current = Date.now();
      clearHeartbeatTimeout();
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      stopHeartbeat();
      console.log(`[Dashboard WS] Disconnected: ${reason}`);
      // 如果是 "io server disconnect"，需要手动重连
      if (reason === "io server disconnect") {
        setTimeout(() => socket.connect(), RECONNECT_DELAY_BASE);
      }
      // 其他原因 socket.io 会自动重连
    });

    socket.on("connect_error", (error) => {
      console.warn(`[Dashboard WS] Connection error: ${error.message}`);
      setIsConnected(false);
    });

    socket.on("reconnect_attempt", (attempt) => {
      setReconnectAttempt(attempt);
      if (attempt % 5 === 0) {
        console.log(`[Dashboard WS] Reconnecting... attempt ${attempt}`);
      }
    });

    socket.on("reconnect", () => {
      console.log("[Dashboard WS] Reconnected successfully");
      setReconnectAttempt(0);
      lastPongRef.current = Date.now();
    });

    socket.on("reconnect_failed", () => {
      console.error("[Dashboard WS] Reconnection failed, will retry...");
      // 即使 reconnect_failed 也继续尝试
      setTimeout(() => {
        if (!socket.connected) {
          socket.connect();
        }
      }, RECONNECT_DELAY_MAX);
    });

    // ─── 页面可见性切换时主动检测连接 ───
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // 页面重新可见时，检查连接状态
        if (!socket.connected) {
          console.log("[Dashboard WS] Page visible, reconnecting...");
          socket.connect();
        } else {
          // 发一个心跳确认连接还活着
          socket.emit("heartbeat");
        }
      }
    };

    // 网络状态变化时重连
    const handleOnline = () => {
      console.log("[Dashboard WS] Network online, reconnecting...");
      if (!socket.connected) {
        socket.connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    // ─── 注册业务事件监听 ───
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
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
