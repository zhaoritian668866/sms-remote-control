import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberStatusDot } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import {
  ArrowLeft, Send, Loader2, Smartphone, Battery, Signal,
  Phone, ChevronDown, Search, UserPlus, X, MessageSquare
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { clearUnread } from "@/hooks/useUnread";

export default function Chat() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const deviceId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [messageBody, setMessageBody] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactNumber, setNewContactNumber] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // 进入聊天页时清除该设备未读
  useEffect(() => {
    if (deviceId > 0) {
      clearUnread(deviceId);
    }
  }, [deviceId]);

  // 获取设备信息
  const { data: device } = trpc.device.get.useQuery(
    { id: deviceId },
    { enabled: !!user && deviceId > 0 }
  );

  // 获取消息列表
  const { data: messageList, refetch: refetchMessages } = trpc.sms.list.useQuery(
    { deviceId, limit: 500, offset: 0 },
    { enabled: !!user && deviceId > 0, refetchInterval: 10000 }
  );

  // 发送短信
  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: (data) => {
      if (data.sendResult.success) {
        toast.success("传书已发出");
        setMessageBody("");
        refetchMessages();
      } else {
        toast.error("传书失败：" + (data.sendResult.error || "未知错误"));
        refetchMessages();
      }
    },
    onError: (err) => {
      toast.error("传书失败：" + err.message);
    },
  });

  // WebSocket 实时消息
  const { on } = useDashboardSocket(user?.id);

  useEffect(() => {
    const unsub1 = on("new_sms", (data: any) => {
      if (data.message?.deviceId === deviceId || data.deviceId === deviceId) {
        refetchMessages();
        // 如果没有选中联系人，自动选中来信号码
        if (!selectedContact && data.message?.phoneNumber) {
          setSelectedContact(data.message.phoneNumber);
        }
      }
    });

    const unsub2 = on("sms_status_update", (data: any) => {
      if (data.deviceId === deviceId) {
        refetchMessages();
      }
    });

    return () => { unsub1(); unsub2(); };
  }, [on, deviceId, selectedContact, refetchMessages]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageList, autoScroll, selectedContact]);

  // 检测滚动位置
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  // 获取所有联系人号码（去重，带最后消息时间和未读数）
  const contacts = useMemo(() => {
    if (!messageList) return [];
    const contactMap = new Map<string, { number: string; lastMsg: string; lastTime: number; unread: number; name?: string }>();
    // 按时间正序遍历，最后的会覆盖
    const sorted = [...messageList].sort((a, b) => a.smsTimestamp - b.smsTimestamp);
    for (const m of sorted) {
      const existing = contactMap.get(m.phoneNumber);
      contactMap.set(m.phoneNumber, {
        number: m.phoneNumber,
        lastMsg: m.body.length > 30 ? m.body.slice(0, 30) + "..." : m.body,
        lastTime: m.smsTimestamp,
        unread: (existing?.unread || 0),
        name: m.contactName || existing?.name,
      });
    }
    // 按最后消息时间倒序
    return Array.from(contactMap.values()).sort((a, b) => b.lastTime - a.lastTime);
  }, [messageList]);

  // 搜索过滤联系人
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.number.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  }, [contacts, contactSearch]);

  // 当消息列表加载后，自动选中最近的联系人
  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      setSelectedContact(contacts[0].number);
    }
  }, [contacts, selectedContact]);

  // 当前联系人的消息（按时间正序）
  const currentMessages = useMemo(() => {
    if (!messageList || !selectedContact) return [];
    return [...messageList]
      .filter(m => m.phoneNumber === selectedContact)
      .sort((a, b) => a.smsTimestamp - b.smsTimestamp);
  }, [messageList, selectedContact]);

  // 切换联系人时滚动到底部
  useEffect(() => {
    setAutoScroll(true);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
  }, [selectedContact]);

  const handleSend = () => {
    if (!selectedContact.trim() || !messageBody.trim()) {
      if (!selectedContact.trim()) {
        toast.error("请先选择或输入收信人号码");
      }
      return;
    }
    sendMutation.mutate({
      deviceId,
      phoneNumber: selectedContact.trim(),
      body: messageBody.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddNewContact = () => {
    if (newContactNumber.trim()) {
      setSelectedContact(newContactNumber.trim());
      setShowNewContact(false);
      setNewContactNumber("");
      setContactSearch("");
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

  const formatShortTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "昨天";
    }
    return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  };

  // 是否需要显示时间戳（间隔超过5分钟）
  const shouldShowTime = (index: number) => {
    if (index === 0) return true;
    const prev = currentMessages[index - 1];
    const curr = currentMessages[index];
    return curr.smsTimestamp - prev.smsTimestamp > 5 * 60 * 1000;
  };

  // 发送状态文字
  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered": return "已送达";
      case "sent": return "已发送";
      case "failed": return "发送失败";
      case "pending": return "发送中...";
      case "received": return "";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
      case "sent": return "text-jade/70";
      case "failed": return "text-vermilion/70";
      case "pending": return "text-muted-foreground/50";
      default: return "text-muted-foreground/40";
    }
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
      <div className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
        {/* ─── 左侧：联系人列表 ─── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-foreground/10 bg-card/60">
          {/* 设备信息头 */}
          <div className="shrink-0 flex items-center gap-3 px-3 py-3 border-b border-foreground/10">
            <button
              onClick={() => setLocation("/devices")}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center">
                <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                <CyberStatusDot online={device?.isOnline ?? false} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-sm text-foreground truncate">
                {device?.name || "加载中..."}
              </h2>
              <div className="flex items-center gap-2 text-xs font-body text-muted-foreground">
                <span>{device?.isOnline ? "在线" : "离线"}</span>
                {device?.batteryLevel != null && (
                  <span className="flex items-center gap-0.5">
                    <Battery className={`w-3 h-3 ${device.batteryLevel < 20 ? "text-vermilion" : ""}`} />
                    {device.batteryLevel}%
                  </span>
                )}
                {device?.signalStrength != null && (
                  <span className="flex items-center gap-0.5">
                    <Signal className="w-3 h-3" />
                    {device.signalStrength}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 搜索栏 */}
          <div className="shrink-0 px-3 py-2 border-b border-foreground/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="搜索联系人号码..."
                className="h-8 text-xs bg-background/50 border-foreground/10 text-foreground font-body pl-8 pr-8"
              />
              {contactSearch && (
                <button
                  onClick={() => setContactSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 新建联系人按钮 */}
          <div className="shrink-0 px-3 py-2 border-b border-foreground/5">
            {showNewContact ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newContactNumber}
                  onChange={e => setNewContactNumber(e.target.value)}
                  placeholder="输入手机号码"
                  className="h-7 text-xs bg-background/50 border-foreground/15 text-foreground font-body flex-1"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddNewContact();
                    if (e.key === "Escape") { setShowNewContact(false); setNewContactNumber(""); }
                  }}
                />
                <button
                  onClick={handleAddNewContact}
                  className="p-1 text-jade hover:text-jade/80"
                  title="确认"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setShowNewContact(false); setNewContactNumber(""); }}
                  className="p-1 text-muted-foreground hover:text-vermilion"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewContact(true)}
                className="flex items-center gap-2 w-full text-xs font-body text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>新建联系人</span>
              </button>
            )}
          </div>

          {/* 联系人列表 */}
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/40">
                <MessageSquare className="w-6 h-6 mb-2" />
                <span className="text-xs font-body">
                  {contactSearch ? "未找到匹配联系人" : "暂无联系人"}
                </span>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <button
                  key={contact.number}
                  onClick={() => { setSelectedContact(contact.number); setContactSearch(""); }}
                  className={`w-full text-left flex items-center gap-3 px-3 py-3 transition-colors border-b border-foreground/5 ${
                    selectedContact === contact.number
                      ? "bg-foreground/8"
                      : "hover:bg-foreground/3"
                  }`}
                >
                  <div className="w-9 h-9 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-serif text-foreground truncate">
                        {contact.name || contact.number}
                      </span>
                      <span className="text-xs font-body text-muted-foreground/50 shrink-0 ml-2">
                        {formatShortTime(contact.lastTime)}
                      </span>
                    </div>
                    <p className="text-xs font-body text-muted-foreground/60 truncate mt-0.5">
                      {contact.lastMsg}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ─── 右侧：对话区域 ─── */}
        <div className="flex-1 flex flex-col">
          {/* 对话头部 */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/80 border-b border-foreground/10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-serif text-sm text-foreground">
                {selectedContact || "请选择联系人"}
              </span>
              {selectedContact && contacts.find(c => c.number === selectedContact)?.name && (
                <span className="text-xs font-body text-muted-foreground">
                  ({contacts.find(c => c.number === selectedContact)?.name})
                </span>
              )}
            </div>
            <div className="text-xs font-body text-muted-foreground/50">
              {currentMessages.length} 条消息
            </div>
          </div>

          {/* 消息区域 */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background/50"
          >
            {!selectedContact ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4 opacity-15">📜</div>
                  <p className="text-sm font-body text-muted-foreground">请从左侧选择联系人开始对话</p>
                  <p className="text-xs font-body text-muted-foreground/50 mt-1">
                    或点击「新建联系人」发送第一条短信
                  </p>
                </div>
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4 opacity-15">✉</div>
                  <p className="text-sm font-body text-muted-foreground">暂无与 {selectedContact} 的消息</p>
                  <p className="text-xs font-body text-muted-foreground/50 mt-1">
                    在下方输入内容发送第一条短信
                  </p>
                </div>
              </div>
            ) : (
              <>
                {currentMessages.map((msg, index) => (
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

                      <div className={`max-w-[65%] ${msg.direction === "outgoing" ? "items-end" : "items-start"} flex flex-col`}>
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

                        {/* 时间 + 状态 */}
                        <div className="flex items-center gap-2 mt-0.5 px-1">
                          <span className="text-xs font-body text-muted-foreground/40">
                            {new Date(msg.smsTimestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {msg.direction === "outgoing" && (
                            <span className={`text-xs font-body ${getStatusColor(msg.status)}`}>
                              {getStatusText(msg.status)}
                            </span>
                          )}
                          {msg.direction === "incoming" && (
                            <span className="text-xs font-body text-muted-foreground/30">
                              已接收
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 发出头像 */}
                      {msg.direction === "outgoing" && (
                        <div className="w-8 h-8 rounded-sm bg-foreground/8 border border-foreground/10 flex items-center justify-center shrink-0 mb-1">
                          <span className="text-xs font-serif text-foreground/60">我</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}

            {/* 滚动到底部按钮 */}
            {!autoScroll && currentMessages.length > 0 && (
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
          <div className="shrink-0 flex items-end gap-3 px-4 py-3 bg-card/80 border-t border-foreground/10 backdrop-blur-sm">
            <div className="flex-1">
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedContact ? `发送至 ${selectedContact}...` : "请先选择联系人..."}
                disabled={!selectedContact}
                rows={1}
                className="w-full bg-background/60 border border-foreground/10 text-foreground font-body text-sm px-3 py-2.5 resize-none focus:outline-none focus:border-foreground/25 transition-colors placeholder:text-muted-foreground/40 disabled:opacity-40"
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
              disabled={sendMutation.isPending || !messageBody.trim() || !selectedContact.trim()}
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
      </div>
    </DashboardLayout>
  );
}
