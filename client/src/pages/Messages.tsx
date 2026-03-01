import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import { Send, MessageSquare, Loader2, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [sendDeviceId, setSendDeviceId] = useState<string>("");
  const [sendPhone, setSendPhone] = useState("");
  const [sendBody, setSendBody] = useState("");

  const { data: deviceList } = trpc.device.list.useQuery(undefined, { enabled: !!user });

  const { data: messageList, refetch: refetchMessages } = trpc.sms.list.useQuery(
    {
      deviceId: selectedDeviceId !== "all" ? parseInt(selectedDeviceId) : undefined,
      limit: 100,
      offset: 0,
    },
    { enabled: !!user }
  );

  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: (data) => {
      if (data.sendResult.success) {
        toast.success("短信已发送");
        setSendBody("");
        setSendPhone("");
        utils.sms.list.invalidate();
      } else {
        toast.error("发送失败: " + (data.sendResult.error || "Unknown error"));
      }
    },
    onError: (err) => {
      toast.error("发送失败: " + err.message);
    },
  });

  const { on } = useDashboardSocket(user?.id);

  const handleNewSms = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  useEffect(() => {
    const unsub = on("new_sms", (data: any) => {
      handleNewSms();
      toast.info(`新短信来自 ${data.deviceName}: ${data.message?.phoneNumber}`, {
        description: data.message?.body?.slice(0, 50),
      });
    });
    return unsub;
  }, [on, handleNewSms]);

  const handleSend = () => {
    if (!sendDeviceId || !sendPhone.trim() || !sendBody.trim()) {
      toast.error("请填写完整的发送信息");
      return;
    }
    sendMutation.mutate({
      deviceId: parseInt(sendDeviceId),
      phoneNumber: sendPhone.trim(),
      body: sendBody.trim(),
    });
  };

  const getDeviceName = (deviceId: number) => {
    const device = deviceList?.find(d => d.id === deviceId);
    return device?.name || `Device #${deviceId}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-wider text-neon-cyan neon-glow-cyan">
              SMS CENTER
            </h1>
            <p className="text-sm font-mono text-muted-foreground mt-1">
              // SEND & RECEIVE SMS MESSAGES
            </p>
          </div>
          <Button
            onClick={() => refetchMessages()}
            variant="outline"
            className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            REFRESH
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send SMS Panel */}
          <CyberPanel title="SEND SMS" subtitle="Compose and send message" accentColor="pink">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">SELECT DEVICE</label>
                <Select value={sendDeviceId} onValueChange={setSendDeviceId}>
                  <SelectTrigger className="bg-background/50 border-neon-pink/30 text-foreground font-mono text-sm">
                    <SelectValue placeholder="选择发送设备..." />
                  </SelectTrigger>
                  <SelectContent className="bg-cyber-dark border-neon-pink/30">
                    {deviceList?.filter(d => d.isOnline).map(device => (
                      <SelectItem key={device.id} value={device.id.toString()} className="font-mono text-sm">
                        {device.name} {device.phoneNumber ? `(${device.phoneNumber})` : ""}
                      </SelectItem>
                    ))}
                    {(!deviceList || deviceList.filter(d => d.isOnline).length === 0) && (
                      <SelectItem value="_none" disabled className="font-mono text-sm text-muted-foreground">
                        无在线设备
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">RECIPIENT NUMBER</label>
                <Input
                  value={sendPhone}
                  onChange={e => setSendPhone(e.target.value)}
                  placeholder="输入接收方手机号..."
                  className="bg-background/50 border-neon-pink/30 text-foreground font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1.5 block">MESSAGE BODY</label>
                <Textarea
                  value={sendBody}
                  onChange={e => setSendBody(e.target.value)}
                  placeholder="输入短信内容..."
                  rows={4}
                  className="bg-background/50 border-neon-pink/30 text-foreground font-body text-sm resize-none"
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={sendMutation.isPending || !sendDeviceId || !sendPhone || !sendBody}
                className="w-full bg-neon-pink/10 border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/20 font-display tracking-wider"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                TRANSMIT
              </Button>
            </div>
          </CyberPanel>

          {/* Message List */}
          <div className="lg:col-span-2">
            <CyberPanel title="MESSAGE LOG" subtitle="All SMS activity" noPadding>
              {/* Filter Bar */}
              <div className="px-4 py-3 border-b border-border/30">
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="w-full sm:w-64 bg-background/50 border-neon-cyan/30 text-foreground font-mono text-sm">
                    <SelectValue placeholder="筛选设备..." />
                  </SelectTrigger>
                  <SelectContent className="bg-cyber-dark border-neon-cyan/30">
                    <SelectItem value="all" className="font-mono text-sm">ALL DEVICES</SelectItem>
                    {deviceList?.map(device => (
                      <SelectItem key={device.id} value={device.id.toString()} className="font-mono text-sm">
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Messages */}
              <div className="max-h-[600px] overflow-y-auto">
                {!messageList || messageList.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-neon-cyan/20 mx-auto mb-3" />
                    <p className="text-sm font-mono text-muted-foreground">NO MESSAGES FOUND</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {messageList.map(msg => (
                      <div key={msg.id} className="px-4 py-3 hover:bg-neon-cyan/5 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {msg.direction === "incoming" ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-neon-green" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-neon-pink" />
                            )}
                            <span className="text-sm font-mono text-neon-cyan">
                              {msg.phoneNumber}
                            </span>
                            {msg.contactName && (
                              <span className="text-xs font-body text-muted-foreground">
                                ({msg.contactName})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-muted-foreground/60">
                              {getDeviceName(msg.deviceId)}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-body text-foreground/80 pl-5.5 whitespace-pre-wrap break-all">
                          {msg.body}
                        </p>
                        <div className="flex items-center gap-2 mt-1 pl-5.5">
                          <span className={`text-xs font-mono px-1.5 py-0.5 ${
                            msg.direction === "incoming"
                              ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                              : "bg-neon-pink/10 text-neon-pink border border-neon-pink/20"
                          }`}>
                            {msg.direction === "incoming" ? "RECEIVED" : "SENT"}
                          </span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 border ${
                            msg.status === "delivered" || msg.status === "received"
                              ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20"
                              : msg.status === "failed"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-muted/30 text-muted-foreground border-border/30"
                          }`}>
                            {msg.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CyberPanel>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
