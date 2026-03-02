import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberStatusDot } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import {
  ArrowLeft, Send, Loader2, Smartphone, Battery, Signal,
  Phone, ChevronDown
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function Chat() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const deviceId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [messageBody, setMessageBody] = useState("");
  const [replyToNumber, setReplyToNumber] = useState("");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // 获取设备信息
  const { data: device } = trpc.device.get.useQuery(
    { id: deviceId },
    { enabled: !!user && deviceId > 0 }
  );

  // 获取消息列表
  const { data: messageList, refetch: refetchMessages } = trpc.sms.list.useQuery(
    { deviceId, limit: 200, offset: 0 },
    { enabled: !!user && deviceId > 0 }
  );

  // 发送短信
  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: (data) => {
      if (data.sendResult.success) {
        toast.success("传书已发出");
        setMessageBody("");
        utils.sms.list.invalidate();
      } else {
        toast.error("传书失败：" + (data.sendResult.error || "未知错误"));
      }
    },
    onError: (err) => {
      toast.error("传书失败：" + err.message);
    },
  });

  // WebSocket 实时消息
  const { on } = useDashboardSocket(user?.id);

  const handleNewSms = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  useEffect(() => {
    const unsub = on("new_sms", (data: any) => {
      if (data.deviceId === deviceId) {
        handleNewSms();
        // 如果没有设置回复号码，自动设置为来信号码
        if (!replyToNumber && data.message?.phoneNumber) {
          setReplyToNumber(data.message.phoneNumber);
        }
      }
    });
    return unsub;
  }, [on, handleNewSms, deviceId, replyToNumber]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageList, autoScroll]);

  // 检测滚动位置
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  // 按联系人号码分组消息（按时间正序）
  const sortedMessages = useMemo(() => {
    if (!messageList) return [];
    return [...messageList].sort((a, b) => a.smsTimestamp - b.smsTimestamp);
  }, [messageList]);

  // 获取所有联系人号码
  const contactNumbers = useMemo(() => {
    if (!messageList) return [];
    const nums = new Set(messageList.map(m => m.phoneNumber));
    return Array.from(nums);
  }, [messageList]);

  // 当消息列表加载后，自动选中最近的联系人
  useEffect(() => {
    if (!replyToNumber && messageList && messageList.length > 0) {
      setReplyToNumber(messageList[0].phoneNumber);
    }
  }, [messageList, replyToNumber]);

  const handleSend = () => {
    if (!replyToNumber.trim() || !messageBody.trim()) {
      if (!replyToNumber.trim()) {
        setShowPhoneInput(true);
        toast.error("请先输入收信人号码");
      }
      return;
    }
    sendMutation.mutate({
      deviceId,
      phoneNumber: replyToNumber.trim(),
      body: messageBody.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 格式化时间
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // 是否需要显示时间戳（间隔超过5分钟）
  const shouldShowTime = (index: number) => {
    if (index === 0) return true;
    const prev = sortedMessages[index - 1];
    const curr = sortedMessages[index];
    return curr.smsTimestamp - prev.smsTimestamp > 5 * 60 * 1000;
  };

  if (!device && deviceId > 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Smartphone className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-body text-muted-foreground">信使不存在或无权访问</p>
            <button
              onClick={() => setLocation("/devices")}
              className="mt-4 text-sm font-serif text-foreground/60 hover:text-foreground underline underline-offset-4"
            >
              返回信使列表
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
        {/* 顶部栏 - 设备信息 */}
        <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-card/80 border border-foreground/10 backdrop-blur-sm">
          {/* 返回按钮 */}
          <button
            onClick={() => setLocation("/devices")}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* 设备头像 */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5">
              <CyberStatusDot online={device?.isOnline ?? false} />
            </div>
          </div>

          {/* 设备信息 */}
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-base text-foreground truncate">
              {device?.name || "加载中..."}
            </h2>
            <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
              <span>{device?.isOnline ? "在线" : "离线"}</span>
              {device?.phoneModel && <span>{device.phoneModel}</span>}
              {device?.phoneNumber && <span>{device.phoneNumber}</span>}
            </div>
          </div>

          {/* 状态指标 */}
          <div className="flex items-center gap-3 shrink-0">
            {device?.batteryLevel != null && (
              <div className="flex items-center gap-1 text-xs font-body text-muted-foreground">
                <Battery className={`w-3.5 h-3.5 ${device.batteryLevel < 20 ? "text-vermilion" : ""}`} />
                <span>{device.batteryLevel}%</span>
              </div>
            )}
            {device?.signalStrength != null && (
              <div className="flex items-center gap-1 text-xs font-body text-muted-foreground">
                <Signal className="w-3.5 h-3.5" />
                <span>{device.signalStrength}%</span>
              </div>
            )}
          </div>
        </div>

        {/* 联系人选择栏 */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-card/40 border-x border-foreground/10">
          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-body text-muted-foreground shrink-0">收信人：</span>
          {showPhoneInput || contactNumbers.length === 0 ? (
            <Input
              value={replyToNumber}
              onChange={e => setReplyToNumber(e.target.value)}
              placeholder="输入手机号码..."
              className="h-7 text-xs bg-background/50 border-foreground/15 text-foreground font-body flex-1"
              autoFocus={showPhoneInput}
            />
          ) : (
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
              {contactNumbers.map(num => (
                <button
                  key={num}
                  onClick={() => setReplyToNumber(num)}
                  className={`shrink-0 px-2.5 py-1 text-xs font-body rounded-sm transition-colors ${
                    replyToNumber === num
                      ? "bg-foreground/10 text-foreground border border-foreground/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => { setShowPhoneInput(true); setReplyToNumber(""); }}
                className="shrink-0 px-2 py-1 text-xs font-body text-muted-foreground/50 hover:text-muted-foreground"
              >
                + 新号码
              </button>
            </div>
          )}
          {showPhoneInput && contactNumbers.length > 0 && (
            <button
              onClick={() => { setShowPhoneInput(false); if (!replyToNumber) setReplyToNumber(contactNumbers[0]); }}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              取消
            </button>
          )}
        </div>

        {/* 消息区域 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background/50 border-x border-foreground/10"
        >
          {!sortedMessages || sortedMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4 opacity-20">📜</div>
                <p className="text-sm font-body text-muted-foreground">暂无传书记录</p>
                <p className="text-xs font-body text-muted-foreground/50 mt-1">
                  在下方输入内容发送第一条短信
                </p>
              </div>
            </div>
          ) : (
            <>
              {sortedMessages.map((msg, index) => (
                <div key={msg.id} className="animate-ink-fade">
                  {/* 时间戳 */}
                  {shouldShowTime(index) && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs font-body text-muted-foreground/50 bg-card/60 px-3 py-1 rounded-sm">
                        {formatTime(msg.smsTimestamp)}
                      </span>
                    </div>
                  )}

                  {/* 消息气泡 */}
                  <div className={`flex items-end gap-2 mb-2 ${
                    msg.direction === "outgoing" ? "justify-end" : "justify-start"
                  }`}>
                    {/* 来信头像 */}
                    {msg.direction === "incoming" && (
                      <div className="w-8 h-8 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0 mb-1">
                        <span className="text-xs font-body text-muted-foreground">
                          {msg.contactName?.charAt(0) || msg.phoneNumber.slice(-2)}
                        </span>
                      </div>
                    )}

                    <div className={`max-w-[70%] ${msg.direction === "outgoing" ? "items-end" : "items-start"} flex flex-col`}>
                      {/* 号码标签 */}
                      <span className="text-xs font-body text-muted-foreground/50 mb-0.5 px-1">
                        {msg.direction === "incoming"
                          ? (msg.contactName || msg.phoneNumber)
                          : `发至 ${msg.phoneNumber}`
                        }
                      </span>

                      {/* 气泡 */}
                      <div
                        className={`px-3 py-2 text-sm font-body leading-relaxed break-all whitespace-pre-wrap ${
                          msg.direction === "outgoing"
                            ? "bubble-outgoing text-foreground"
                            : "bubble-incoming text-foreground"
                        }`}
                      >
                        {msg.body}
                      </div>

                      {/* 状态 */}
                      {msg.direction === "outgoing" && (
                        <span className={`text-xs font-body mt-0.5 px-1 ${
                          msg.status === "delivered" || msg.status === "sent"
                            ? "text-jade/60"
                            : msg.status === "failed"
                            ? "text-vermilion/60"
                            : "text-muted-foreground/40"
                        }`}>
                          {msg.status === "delivered" ? "已送达" :
                           msg.status === "sent" ? "已发送" :
                           msg.status === "failed" ? "发送失败" :
                           msg.status === "pending" ? "发送中..." : msg.status}
                        </span>
                      )}
                    </div>

                    {/* 发出头像 */}
                    {msg.direction === "outgoing" && (
                      <div className="w-8 h-8 rounded-sm bg-foreground/8 border border-foreground/10 flex items-center justify-center shrink-0 mb-1">
                        <span className="text-xs font-serif text-foreground/60">我</span>
                      </div>
                    )}
                  </div>

                  {/* 快速回复按钮 - 仅来信显示 */}
                  {msg.direction === "incoming" && (
                    <div className="flex justify-start ml-10 -mt-1 mb-1">
                      <button
                        onClick={() => {
                          setReplyToNumber(msg.phoneNumber);
                          setShowPhoneInput(false);
                        }}
                        className="text-xs font-body text-muted-foreground/40 hover:text-foreground/60 transition-colors"
                      >
                        回复此号码
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}

          {/* 滚动到底部按钮 */}
          {!autoScroll && sortedMessages.length > 0 && (
            <button
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                setAutoScroll(true);
              }}
              className="fixed bottom-24 right-8 w-8 h-8 bg-card border border-foreground/15 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-lg z-10"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 输入区域 */}
        <div className="shrink-0 flex items-end gap-3 px-4 py-3 bg-card/80 border border-foreground/10 backdrop-blur-sm">
          <div className="flex-1">
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyToNumber ? `发送至 ${replyToNumber}...` : "请先选择收信人..."}
              rows={1}
              className="w-full bg-background/60 border border-foreground/10 text-foreground font-body text-sm px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/25 transition-colors placeholder:text-muted-foreground/40"
              style={{ minHeight: "40px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !messageBody.trim() || !replyToNumber.trim()}
            className="bg-foreground/8 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif tracking-wider h-10 px-5 shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
