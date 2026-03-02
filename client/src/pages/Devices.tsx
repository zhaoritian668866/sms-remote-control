import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel, CyberStatusDot } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import { useUnreadCounts } from "@/hooks/useUnread";
import {
  Smartphone, Plus, Trash2, Edit2, Check, X, QrCode,
  Battery, Signal, Loader2, ChevronRight
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { clearUnread } from "@/hooks/useUnread";

export default function Devices() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const { counts: unreadCounts } = useUnreadCounts();

  const { data: deviceList, refetch } = trpc.device.list.useQuery(undefined, {
    enabled: !!user,
  });

  const generatePairing = trpc.pairing.generate.useMutation({
    onSuccess: () => {
      setShowQrDialog(true);
    },
    onError: (err) => {
      toast.error("生成二维码失败：" + err.message);
    },
  });

  const renameMutation = trpc.device.rename.useMutation({
    onSuccess: () => {
      utils.device.list.invalidate();
      setEditingId(null);
      toast.success("信使已更名");
    },
  });

  const removeMutation = trpc.device.remove.useMutation({
    onSuccess: () => {
      utils.device.list.invalidate();
      toast.success("信使已移除");
    },
  });

  const { on } = useDashboardSocket(user?.id);

  const handleDeviceEvent = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const unsub1 = on("device_paired", (data: any) => {
      handleDeviceEvent();
      setShowQrDialog(false);
      toast.success(`新信使已加入：${data.device?.name || "未知"}`);
    });
    const unsub2 = on("device_online", handleDeviceEvent);
    const unsub3 = on("device_offline", handleDeviceEvent);
    const unsub4 = on("device_status", handleDeviceEvent);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, handleDeviceEvent]);

  const handleRename = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const submitRename = (id: number) => {
    if (editName.trim()) {
      renameMutation.mutate({ id, name: editName.trim() });
    }
  };

  const handleRemove = (id: number, name: string) => {
    if (confirm(`确认移除信使「${name}」？所有相关传书记录也将一并删除。`)) {
      removeMutation.mutate({ id });
    }
  };

  const handleEnterChat = (deviceId: number) => {
    clearUnread(deviceId);
    setLocation(`/chat/${deviceId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display tracking-widest text-foreground">
              信使管理
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-1">
              管理已绑定的设备，点击信使进入对话
            </p>
          </div>
          <Button
            onClick={() => generatePairing.mutate()}
            disabled={generatePairing.isPending}
            className="bg-foreground/5 border border-foreground/20 text-foreground hover:bg-foreground/10 font-serif tracking-wider text-sm"
          >
            {generatePairing.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            添加信使
          </Button>
        </div>

        {/* 设备列表 */}
        {!deviceList || deviceList.length === 0 ? (
          <CyberPanel title="暂无信使">
            <div className="text-center py-12">
              <Smartphone className="w-16 h-16 text-muted-foreground/15 mx-auto mb-4" />
              <p className="text-lg font-display text-muted-foreground mb-2">尚无信使加入</p>
              <p className="text-sm font-body text-muted-foreground mb-6">
                点击「添加信使」生成二维码，用手机扫码即可绑定
              </p>
              <Button
                onClick={() => generatePairing.mutate()}
                disabled={generatePairing.isPending}
                className="bg-foreground/5 border border-foreground/20 text-foreground hover:bg-foreground/10 font-serif tracking-wider"
              >
                <QrCode className="w-4 h-4 mr-2" />
                生成二维码
              </Button>
            </div>
          </CyberPanel>
        ) : (
          <CyberPanel noPadding>
            <div className="divide-y divide-foreground/5">
              {deviceList.map(device => {
                const unread = unreadCounts[device.id] || 0;
                return (
                  <div
                    key={device.id}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-foreground/3 transition-colors group"
                  >
                    {/* 头像区域 + 点击进入 */}
                    <div
                      className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleEnterChat(device.id)}
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <CyberStatusDot online={device.isOnline} />
                        </div>
                        {/* 未读红色气泡 */}
                        {unread > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vermilion text-white text-[10px] font-body font-bold flex items-center justify-center leading-none shadow-sm">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>

                      {/* 信息区域 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          {editingId === device.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Input
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="h-7 w-32 text-sm bg-background/50 border-foreground/20 text-foreground font-body"
                                onKeyDown={e => {
                                  if (e.key === "Enter") submitRename(device.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                autoFocus
                              />
                              <button onClick={() => submitRename(device.id)} className="text-jade hover:text-jade/80">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-vermilion hover:text-vermilion/80">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-serif text-sm text-foreground truncate">{device.name}</span>
                          )}
                          <span className="text-xs font-body text-muted-foreground/60 shrink-0 ml-2">
                            {device.lastSeen ? new Date(device.lastSeen).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
                          <span>{device.phoneModel || "未知型号"}</span>
                          {device.phoneNumber && <span className="text-foreground/60">{device.phoneNumber}</span>}
                          {device.batteryLevel != null && (
                            <span className="flex items-center gap-0.5">
                              <Battery className={`w-3 h-3 ${device.batteryLevel < 20 ? "text-vermilion" : ""}`} />
                              {device.batteryLevel}%
                            </span>
                          )}
                          {device.signalStrength != null && (
                            <span className="flex items-center gap-0.5">
                              <Signal className="w-3 h-3" />
                              {device.signalStrength}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRename(device.id, device.name); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="更名"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(device.id, device.name); }}
                        className="p-1.5 text-muted-foreground hover:text-vermilion transition-colors"
                        title="移除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 进入箭头 */}
                    <div
                      className="shrink-0 cursor-pointer text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                      onClick={() => handleEnterChat(device.id)}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CyberPanel>
        )}

        {/* 二维码弹窗 */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="bg-card border-foreground/15 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-lg tracking-widest text-foreground text-center">
                扫码绑定
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {generatePairing.data?.qrDataUrl ? (
                <>
                  <div className="relative p-3 border border-foreground/15">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-foreground/30" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-foreground/30" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-foreground/30" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-foreground/30" />
                    <img
                      src={generatePairing.data.qrDataUrl}
                      alt="配对二维码"
                      className="w-64 h-64"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-body text-muted-foreground">
                      请使用手机端应用扫描此二维码
                    </p>
                    <p className="text-xs font-body text-vermilion">
                      有效期：10 分钟
                    </p>
                    <p className="text-xs font-body text-muted-foreground/40">
                      令牌：{generatePairing.data.token.slice(0, 8)}...
                    </p>
                  </div>
                </>
              ) : (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
