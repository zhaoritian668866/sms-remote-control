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
        toast.success("传书已发出");
        setSendBody("");
        setSendPhone("");
        utils.sms.list.invalidate();
      } else {
        toast.error("传书失败：" + (data.sendResult.error || "未知错误"));
      }
    },
    onError: (err) => {
      toast.error("传书失败：" + err.message);
    },
  });

  const { on } = useDashboardSocket(user?.id);

  const handleNewSms = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  useEffect(() => {
    const unsub = on("new_sms", (data: any) => {
      handleNewSms();
      toast.info(`新传书来自 ${data.deviceName}：${data.message?.phoneNumber}`, {
        description: data.message?.body?.slice(0, 50),
      });
    });
    return unsub;
  }, [on, handleNewSms]);

  const handleSend = () => {
    if (!sendDeviceId || !sendPhone.trim() || !sendBody.trim()) {
      toast.error("请填写完整的传书信息");
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
    return device?.name || `信使 #${deviceId}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display tracking-widest text-foreground">
              传书中心
            </h1>
            <p className="text-sm font-body text-muted-foreground mt-1">
              收发短信，总览所有传书动态
            </p>
          </div>
          <Button
            onClick={() => refetchMessages()}
            variant="outline"
            className="border-foreground/15 text-foreground hover:bg-foreground/5 font-body text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 发送面板 */}
          <CyberPanel title="发送传书" subtitle="选择信使并编写短信">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1.5 block">选择信使</label>
                <Select value={sendDeviceId} onValueChange={setSendDeviceId}>
                  <SelectTrigger className="bg-background/50 border-foreground/15 text-foreground font-body text-sm">
                    <SelectValue placeholder="请选择发送设备..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-foreground/15">
                    {deviceList?.filter(d => d.isOnline).map(device => (
                      <SelectItem key={device.id} value={device.id.toString()} className="font-body text-sm">
                        {device.name} {device.phoneNumber ? `（${device.phoneNumber}）` : ""}
                      </SelectItem>
                    ))}
                    {(!deviceList || deviceList.filter(d => d.isOnline).length === 0) && (
                      <SelectItem value="_none" disabled className="font-body text-sm text-muted-foreground">
                        暂无在线信使
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-body text-muted-foreground mb-1.5 block">收信人号码</label>
                <Input
                  value={sendPhone}
                  onChange={e => setSendPhone(e.target.value)}
                  placeholder="输入收信方手机号..."
                  className="bg-background/50 border-foreground/15 text-foreground font-body text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-body text-muted-foreground mb-1.5 block">传书内容</label>
                <Textarea
                  value={sendBody}
                  onChange={e => setSendBody(e.target.value)}
                  placeholder="输入短信内容..."
                  rows={4}
                  className="bg-background/50 border-foreground/15 text-foreground font-body text-sm resize-none"
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={sendMutation.isPending || !sendDeviceId || !sendPhone || !sendBody}
                className="w-full bg-foreground/5 border border-foreground/20 text-foreground hover:bg-foreground/10 font-serif tracking-wider"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                发送
              </Button>
            </div>
          </CyberPanel>

          {/* 消息列表 */}
          <div className="lg:col-span-2">
            <CyberPanel title="传书记录" subtitle="所有短信动态" noPadding>
              {/* 筛选栏 */}
              <div className="px-4 py-3 border-b border-foreground/5">
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="w-full sm:w-64 bg-background/50 border-foreground/15 text-foreground font-body text-sm">
                    <SelectValue placeholder="筛选信使..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-foreground/15">
                    <SelectItem value="all" className="font-body text-sm">全部信使</SelectItem>
                    {deviceList?.map(device => (
                      <SelectItem key={device.id} value={device.id.toString()} className="font-body text-sm">
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 消息 */}
              <div className="max-h-[600px] overflow-y-auto">
                {!messageList || messageList.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/15 mx-auto mb-3" />
                    <p className="text-sm font-body text-muted-foreground">暂无传书记录</p>
                  </div>
                ) : (
                  <div className="divide-y divide-foreground/5">
                    {messageList.map(msg => (
                      <div key={msg.id} className="px-4 py-3 hover:bg-foreground/3 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {msg.direction === "incoming" ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-jade" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-vermilion" />
                            )}
                            <span className="text-sm font-body text-foreground/80">
                              {msg.phoneNumber}
                            </span>
                            {msg.contactName && (
                              <span className="text-xs font-body text-muted-foreground">
                                （{msg.contactName}）
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-body text-muted-foreground/50">
                              {getDeviceName(msg.deviceId)}
                            </span>
                            <span className="text-xs font-body text-muted-foreground">
                              {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-body text-foreground/70 pl-5.5 whitespace-pre-wrap break-all">
                          {msg.body}
                        </p>
                        <div className="flex items-center gap-2 mt-1 pl-5.5">
                          <span className={`text-xs font-body px-1.5 py-0.5 ${
                            msg.direction === "incoming"
                              ? "bg-jade/10 text-jade border border-jade/20"
                              : "bg-vermilion/10 text-vermilion border border-vermilion/20"
                          }`}>
                            {msg.direction === "incoming" ? "收信" : "发信"}
                          </span>
                          <span className={`text-xs font-body px-1.5 py-0.5 border ${
                            msg.status === "delivered" || msg.status === "received"
                              ? "bg-jade/10 text-jade border-jade/20"
                              : msg.status === "failed"
                              ? "bg-vermilion/10 text-vermilion border-vermilion/20"
                              : "bg-muted/30 text-muted-foreground border-foreground/10"
                          }`}>
                            {msg.status === "delivered" ? "已送达" :
                             msg.status === "received" ? "已接收" :
                             msg.status === "sent" ? "已发送" :
                             msg.status === "failed" ? "失败" :
                             msg.status === "pending" ? "发送中" : msg.status}
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
