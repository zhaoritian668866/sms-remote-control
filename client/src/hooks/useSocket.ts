import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export function useDashboardSocket(userId: number | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const socket = io("/dashboard", {
      path: "/api/ws",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("register", { userId });
    });

    socket.on("registered", () => {
      console.log("[Dashboard WS] Registered successfully");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Re-register all existing listeners
    const events = [
      "device_paired",
      "device_online",
      "device_offline",
      "device_status",
      "new_sms",
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

  return { isConnected, on };
}
