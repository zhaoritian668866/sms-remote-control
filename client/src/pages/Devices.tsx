import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel, CyberStatusDot } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import {
  Smartphone, Plus, Trash2, Edit2, Check, X, QrCode,
  Battery, Signal, Clock, Loader2
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export default function Devices() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: deviceList, refetch } = trpc.device.list.useQuery(undefined, {
    enabled: !!user,
  });

  const generatePairing = trpc.pairing.generate.useMutation({
    onSuccess: () => {
      setShowQrDialog(true);
    },
    onError: (err) => {
      toast.error("Failed to generate QR code: " + err.message);
    },
  });

  const renameMutation = trpc.device.rename.useMutation({
    onSuccess: () => {
      utils.device.list.invalidate();
      setEditingId(null);
      toast.success("Device renamed");
    },
  });

  const removeMutation = trpc.device.remove.useMutation({
    onSuccess: () => {
      utils.device.list.invalidate();
      toast.success("Device removed");
    },
  });

  const { on } = useDashboardSocket(user?.id);

  const handleDeviceEvent = useCallback(() => {
    refetch();
    // If QR dialog is open and device paired, close it
  }, [refetch]);

  useEffect(() => {
    const unsub1 = on("device_paired", (data: any) => {
      handleDeviceEvent();
      setShowQrDialog(false);
      toast.success(`New device paired: ${data.device?.name || "Unknown"}`);
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
    if (confirm(`确认删除设备 "${name}"？所有相关短信记录也将被删除。`)) {
      removeMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-wider text-neon-cyan neon-glow-cyan">
              DEVICE MANAGEMENT
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-1">
              // MANAGE CONNECTED ANDROID DEVICES
            </p>
          </div>
          <Button
            onClick={() => generatePairing.mutate()}
            disabled={generatePairing.isPending}
            className="bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 font-display tracking-wider text-sm"
          >
            {generatePairing.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            ADD DEVICE
          </Button>
        </div>

        {/* Device Grid */}
        {!deviceList || deviceList.length === 0 ? (
          <CyberPanel title="NO DEVICES">
            <div className="text-center py-12">
              <Smartphone className="w-16 h-16 text-neon-cyan/20 mx-auto mb-4" />
              <p className="text-lg font-display text-muted-foreground mb-2">NO DEVICES CONNECTED</p>
              <p className="text-sm font-mono text-muted-foreground mb-6">
                Click "ADD DEVICE" to generate a QR code, then scan with your Android phone
              </p>
              <Button
                onClick={() => generatePairing.mutate()}
                disabled={generatePairing.isPending}
                className="bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 font-display tracking-wider"
              >
                <QrCode className="w-4 h-4 mr-2" />
                GENERATE QR CODE
              </Button>
            </div>
          </CyberPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deviceList.map(device => (
              <CyberPanel
                key={device.id}
                accentColor={device.isOnline ? "cyan" : "purple"}
              >
                <div className="space-y-3">
                  {/* Device Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CyberStatusDot online={device.isOnline} />
                      {editingId === device.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="h-7 w-32 text-sm bg-background/50 border-neon-cyan/30 text-foreground font-body"
                            onKeyDown={e => {
                              if (e.key === "Enter") submitRename(device.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                          />
                          <button onClick={() => submitRename(device.id)} className="text-neon-green hover:text-neon-green/80">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-destructive hover:text-destructive/80">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-body text-sm font-semibold text-foreground">{device.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRename(device.id, device.name)}
                        className="p-1 text-muted-foreground hover:text-neon-cyan transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemove(device.id, device.name)}
                        className="p-1 text-muted-foreground hover:text-neon-pink transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Device Info */}
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-muted-foreground">
                      <span>MODEL</span>
                      <span className="text-foreground/80">{device.phoneModel || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>ANDROID</span>
                      <span className="text-foreground/80">{device.androidVersion || "Unknown"}</span>
                    </div>
                    {device.phoneNumber && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>PHONE</span>
                        <span className="text-neon-cyan">{device.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>ID</span>
                      <span className="text-foreground/60">{device.deviceId.slice(0, 16)}</span>
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div className="flex items-center gap-4 pt-2 border-t border-border/30">
                    {device.batteryLevel != null && (
                      <div className="flex items-center gap-1.5">
                        <Battery className={`w-3.5 h-3.5 ${device.batteryLevel < 20 ? "text-destructive" : "text-neon-green"}`} />
                        <span className={`text-xs font-mono ${device.batteryLevel < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                          {device.batteryLevel}%
                        </span>
                      </div>
                    )}
                    {device.signalStrength != null && (
                      <div className="flex items-center gap-1.5">
                        <Signal className="w-3.5 h-3.5 text-neon-cyan" />
                        <span className="text-xs font-mono text-muted-foreground">{device.signalStrength}%</span>
                      </div>
                    )}
                    {device.lastSeen && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">
                          {new Date(device.lastSeen).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Label */}
                  <div className={`text-center py-1 text-xs font-display tracking-wider ${
                    device.isOnline
                      ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                      : "bg-muted/30 text-muted-foreground border border-border/30"
                  }`}>
                    {device.isOnline ? "● ONLINE" : "○ OFFLINE"}
                  </div>
                </div>
              </CyberPanel>
            ))}
          </div>
        )}

        {/* QR Code Dialog */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="bg-cyber-dark border-neon-cyan/30 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-neon-cyan tracking-wider text-center neon-glow-cyan">
                SCAN TO PAIR
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {generatePairing.data?.qrDataUrl ? (
                <>
                  <div className="relative p-2 border border-neon-cyan/30">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan" />
                    <img
                      src={generatePairing.data.qrDataUrl}
                      alt="Pairing QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-mono text-muted-foreground">
                      使用 Android 被控端 APP 扫描此二维码
                    </p>
                    <p className="text-xs font-mono text-neon-pink">
                      有效期: 10 分钟
                    </p>
                    <p className="text-xs font-mono text-muted-foreground/60">
                      TOKEN: {generatePairing.data.token.slice(0, 8)}...
                    </p>
                  </div>
                </>
              ) : (
                <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
