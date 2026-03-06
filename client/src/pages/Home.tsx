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
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display tracking-widest text-foreground">
              总堂概览
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-1">
              实时监控所有信使与传书动态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CyberStatusDot online={isConnected} />
            <span className="text-xs font-body text-muted-foreground">
              {isConnected ? "通道畅通" : "通道断开"}
            </span>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CyberStatCard
            label="信使总数"
            value={totalCount}
            icon={<Smartphone className="w-4 h-4" />}
          />
          <CyberStatCard
            label="在线信使"
            value={onlineCount}
            icon={<Wifi className="w-4 h-4" />}
          />
          <CyberStatCard
            label="近期传书"
            value={messageCount}
            icon={<MessageSquare className="w-4 h-4" />}
          />
          <CyberStatCard
            label="系统状态"
            value={isConnected ? "运行中" : "待命"}
            icon={<Activity className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 设备列表 */}
          <CyberPanel title="信使列表" subtitle="已绑定的设备">
            {!deviceList || deviceList.length === 0 ? (
              <div className="text-center py-8">
                <Smartphone className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-body text-muted-foreground">尚无信使加入</p>
                <button
                  onClick={() => setLocation("/devices")}
                  className="mt-3 text-xs font-serif text-foreground/60 hover:text-foreground underline underline-offset-4"
                >
                  前往添加信使
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {deviceList.slice(0, 5).map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-background/50 border border-foreground/5 hover:border-foreground/15 transition-colors cursor-pointer"
                    onClick={() => setLocation("/devices")}
                  >
                    <div className="flex items-center gap-3">
                      <CyberStatusDot online={device.isOnline} />
                      <div>
                        <p className="text-sm font-serif text-foreground">{device.name}</p>
                        <p className="text-xs font-body text-muted-foreground">
                          {device.phoneModel || device.deviceId.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-body text-muted-foreground">
                      {device.batteryLevel != null && (
                        <span className={device.batteryLevel < 20 ? "text-vermilion" : ""}>
                          电量 {device.batteryLevel}%
                        </span>
                      )}
                      {device.signalStrength != null && (
                        <span>信号 {device.signalStrength}%</span>
                      )}
                    </div>
                  </div>
                ))}
                {deviceList.length > 5 && (
                  <button
                    onClick={() => setLocation("/devices")}
                    className="w-full text-center text-xs font-serif text-muted-foreground hover:text-foreground py-2"
                  >
                    查看全部 {deviceList.length} 位信使
                  </button>
                )}
              </div>
            )}
          </CyberPanel>

          {/* 近期消息 */}
          <CyberPanel title="近期传书" subtitle="最新短信动态">
            {!recentMessages || recentMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-body text-muted-foreground">暂无传书记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMessages.slice(0, 5).map(msg => (
                  <div
                    key={msg.id}
                    className="p-3 bg-background/50 border border-foreground/5 hover:border-foreground/15 transition-colors cursor-pointer"
                    onClick={() => setLocation("/messages")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-body text-muted-foreground">
                        {msg.direction === "incoming" ? "◁ 收" : "▷ 发"} {msg.phoneNumber}
                      </span>
                      <span className="text-xs font-body text-muted-foreground/60">
                        {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="text-sm font-body text-foreground/80 truncate">{msg.body}</p>
                  </div>
                ))}
                {recentMessages.length > 5 && (
                  <button
                    onClick={() => setLocation("/messages")}
                    className="w-full text-center text-xs font-serif text-muted-foreground hover:text-foreground py-2"
                  >
                    查看全部传书
                  </button>
                )}
              </div>
            )}
          </CyberPanel>
        </div>

        {/* 系统信息 */}
        <CyberPanel title="系统信息" subtitle="连接与协议详情">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-body">
            <div>
              <span className="text-muted-foreground">通信协议：</span>
              <span className="text-foreground/80 ml-1">MQTT</span>
            </div>
            <div>
              <span className="text-muted-foreground">最大信使数：</span>
              <span className="text-foreground/80 ml-1">30</span>
            </div>
            <div>
              <span className="text-muted-foreground">加密方式：</span>
              <span className="text-foreground/80 ml-1">TLS 1.3</span>
            </div>
          </div>
        </CyberPanel>
      </div>
    </DashboardLayout>
  );
}
