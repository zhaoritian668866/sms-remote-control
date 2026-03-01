import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel, CyberStatCard, CyberStatusDot } from "@/components/CyberPanel";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import { Smartphone, MessageSquare, Wifi, Activity } from "lucide-react";
import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: deviceList, refetch: refetchDevices } = trpc.device.list.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: recentMessages } = trpc.sms.list.useQuery(
    { limit: 10, offset: 0 },
    { enabled: !!user }
  );

  const { isConnected, on } = useDashboardSocket(user?.id);

  const handleDeviceEvent = useCallback(() => {
    refetchDevices();
  }, [refetchDevices]);

  useEffect(() => {
    const unsub1 = on("device_paired", handleDeviceEvent);
    const unsub2 = on("device_online", handleDeviceEvent);
    const unsub3 = on("device_offline", handleDeviceEvent);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, handleDeviceEvent]);

  const onlineCount = deviceList?.filter(d => d.isOnline).length ?? 0;
  const totalCount = deviceList?.length ?? 0;
  const messageCount = recentMessages?.length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-wider text-neon-cyan neon-glow-cyan">
              SYSTEM DASHBOARD
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-1">
              // REAL-TIME DEVICE MONITORING & SMS CONTROL
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CyberStatusDot online={isConnected} />
            <span className="text-xs font-mono text-muted-foreground">
              {isConnected ? "LINK ACTIVE" : "LINK DOWN"}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CyberStatCard
            label="TOTAL DEVICES"
            value={totalCount}
            icon={<Smartphone className="w-4 h-4" />}
            accentColor="cyan"
          />
          <CyberStatCard
            label="ONLINE"
            value={onlineCount}
            icon={<Wifi className="w-4 h-4" />}
            accentColor="cyan"
          />
          <CyberStatCard
            label="RECENT SMS"
            value={messageCount}
            icon={<MessageSquare className="w-4 h-4" />}
            accentColor="pink"
          />
          <CyberStatCard
            label="SYSTEM STATUS"
            value={isConnected ? "ACTIVE" : "STANDBY"}
            icon={<Activity className="w-4 h-4" />}
            accentColor={isConnected ? "cyan" : "purple"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Device List */}
          <CyberPanel title="CONNECTED DEVICES" subtitle="Active device connections">
            {!deviceList || deviceList.length === 0 ? (
              <div className="text-center py-8">
                <Smartphone className="w-10 h-10 text-neon-cyan/30 mx-auto mb-3" />
                <p className="text-sm font-mono text-muted-foreground">NO DEVICES CONNECTED</p>
                <button
                  onClick={() => setLocation("/devices")}
                  className="mt-3 text-xs font-mono text-neon-cyan hover:text-neon-cyan/80 underline underline-offset-4"
                >
                  [ ADD DEVICE ]
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {deviceList.slice(0, 5).map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-background/50 border border-border/50 hover:border-neon-cyan/30 transition-colors cursor-pointer"
                    onClick={() => setLocation("/devices")}
                  >
                    <div className="flex items-center gap-3">
                      <CyberStatusDot online={device.isOnline} />
                      <div>
                        <p className="text-sm font-body text-foreground">{device.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {device.phoneModel || device.deviceId.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      {device.batteryLevel != null && (
                        <span className={device.batteryLevel < 20 ? "text-destructive" : ""}>
                          BAT: {device.batteryLevel}%
                        </span>
                      )}
                      {device.signalStrength != null && (
                        <span>SIG: {device.signalStrength}%</span>
                      )}
                    </div>
                  </div>
                ))}
                {deviceList.length > 5 && (
                  <button
                    onClick={() => setLocation("/devices")}
                    className="w-full text-center text-xs font-mono text-neon-cyan hover:text-neon-cyan/80 py-2"
                  >
                    [ VIEW ALL {deviceList.length} DEVICES ]
                  </button>
                )}
              </div>
            )}
          </CyberPanel>

          {/* Recent Messages */}
          <CyberPanel title="RECENT MESSAGES" subtitle="Latest SMS activity" accentColor="pink">
            {!recentMessages || recentMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-neon-pink/30 mx-auto mb-3" />
                <p className="text-sm font-mono text-muted-foreground">NO MESSAGES YET</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMessages.slice(0, 5).map(msg => (
                  <div
                    key={msg.id}
                    className="p-3 bg-background/50 border border-border/50 hover:border-neon-pink/30 transition-colors cursor-pointer"
                    onClick={() => setLocation("/messages")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-neon-pink">
                        {msg.direction === "incoming" ? "◀ IN" : "▶ OUT"} {msg.phoneNumber}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="text-sm font-body text-foreground/80 truncate">{msg.body}</p>
                  </div>
                ))}
                {recentMessages.length > 5 && (
                  <button
                    onClick={() => setLocation("/messages")}
                    className="w-full text-center text-xs font-mono text-neon-pink hover:text-neon-pink/80 py-2"
                  >
                    [ VIEW ALL MESSAGES ]
                  </button>
                )}
              </div>
            )}
          </CyberPanel>
        </div>

        {/* System Info */}
        <CyberPanel title="SYSTEM INFO" subtitle="Connection & protocol details" accentColor="purple">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">PROTOCOL:</span>
              <span className="text-neon-purple ml-2">WebSocket v4.x</span>
            </div>
            <div>
              <span className="text-muted-foreground">MAX DEVICES:</span>
              <span className="text-neon-purple ml-2">30</span>
            </div>
            <div>
              <span className="text-muted-foreground">ENCRYPTION:</span>
              <span className="text-neon-purple ml-2">TLS 1.3</span>
            </div>
          </div>
        </CyberPanel>
      </div>
    </DashboardLayout>
  );
}
