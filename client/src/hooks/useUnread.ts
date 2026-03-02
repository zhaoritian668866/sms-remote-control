import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDashboardSocket } from "@/hooks/useSocket";

/**
 * 全局未读消息管理
 * 使用 localStorage 持久化未读计数
 */

const STORAGE_KEY = "sms_unread_counts";

function loadUnreadCounts(): Record<number, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveUnreadCounts(counts: Record<number, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {}
}

// 全局状态（跨组件共享）
let globalUnreadCounts: Record<number, number> = loadUnreadCounts();
let listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function incrementUnread(deviceId: number) {
  globalUnreadCounts = { ...globalUnreadCounts, [deviceId]: (globalUnreadCounts[deviceId] || 0) + 1 };
  saveUnreadCounts(globalUnreadCounts);
  notifyListeners();
}

export function clearUnread(deviceId: number) {
  if (globalUnreadCounts[deviceId]) {
    globalUnreadCounts = { ...globalUnreadCounts, [deviceId]: 0 };
    saveUnreadCounts(globalUnreadCounts);
    notifyListeners();
  }
}

export function getTotalUnread(): number {
  return Object.values(globalUnreadCounts).reduce((sum, n) => sum + n, 0);
}

export function useUnreadCounts() {
  const [counts, setCounts] = useState<Record<number, number>>(globalUnreadCounts);
  const { user } = useAuth();
  const { on } = useDashboardSocket(user?.id);

  useEffect(() => {
    const listener = () => {
      setCounts({ ...globalUnreadCounts });
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  // 监听新消息自动增加未读数
  useEffect(() => {
    if (!user) return;
    const unsub = on("new_sms", (data: any) => {
      const dId = data.message?.deviceId;
      if (dId) {
        incrementUnread(dId);
      }
    });
    return unsub;
  }, [on, user]);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return { counts, total, clearUnread, incrementUnread };
}
