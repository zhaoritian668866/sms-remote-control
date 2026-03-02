import { useAuth } from "@/_core/hooks/useAuth";
import { useDashboardSocket } from "@/hooks/useSocket";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { MessageSquare } from "lucide-react";

/**
 * 全局新消息通知组件
 * 监听所有设备的新短信，在右下角弹窗显示，点击可直接进入对话
 */
export function GlobalNotification() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { on } = useDashboardSocket(user?.id);
  const utils = trpc.useUtils();

  const handleNewSms = useCallback((data: any) => {
    const deviceName = data.deviceName || "未知设备";
    const phoneNumber = data.message?.phoneNumber || "未知号码";
    const body = data.message?.body || "";
    const deviceId = data.message?.deviceId;
    const contactName = data.message?.contactName;
    const displayName = contactName || phoneNumber;
    const preview = body.length > 40 ? body.slice(0, 40) + "..." : body;

    // 如果当前已在该设备的聊天页面，不弹通知
    if (location === `/chat/${deviceId}`) return;

    // 弹窗通知
    toast(
      <div
        className="flex items-start gap-3 cursor-pointer w-full"
        onClick={() => {
          if (deviceId) {
            setLocation(`/chat/${deviceId}`);
          }
          toast.dismiss();
        }}
      >
        <div className="w-9 h-9 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4 text-jade" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-serif text-foreground truncate">
              {deviceName}
            </span>
          </div>
          <p className="text-xs font-body text-foreground/80 mt-0.5">
            {displayName}：{preview}
          </p>
        </div>
      </div>,
      {
        duration: 6000,
        position: "bottom-right",
        className: "!bg-card !border !border-foreground/15 !text-foreground !shadow-lg",
      }
    );

    // 刷新设备列表（更新未读数等）
    utils.device.list.invalidate();
  }, [location, setLocation, utils]);

  useEffect(() => {
    if (!user) return;
    const unsub = on("new_sms", handleNewSms);
    return unsub;
  }, [on, user, handleNewSms]);

  return null; // 纯逻辑组件，不渲染 UI
}
