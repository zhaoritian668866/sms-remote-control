import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberStatusDot } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useDashboardSocket } from "@/hooks/useSocket";
import {
  ArrowLeft, Send, Loader2, Smartphone, Battery, Signal,
  Phone, ChevronDown, Search, UserPlus, X, MessageSquare, Pin, PinOff, ImagePlus, Terminal, RefreshCw
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [deviceLogs, setDeviceLogs] = useState<Array<{level: string; tag: string; message: string; timestamp: number}>>([])
  const [showDeviceLogs, setShowDeviceLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [syncingHistory, setSyncingHistory] = useState(false);

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

  // 获取联系人列表（独立接口，不受消息条数限制）
  const { data: chatContactList, refetch: refetchContacts } = trpc.sms.chatContacts.useQuery(
    { deviceId },
    { enabled: !!user && deviceId > 0, refetchInterval: 15000 }
  );

  // 获取当前选中联系人的消息（按联系人单独加载，不受全局 limit 限制）
  const { data: messageList, refetch: refetchMessages } = trpc.sms.contactMessages.useQuery(
    { deviceId, phoneNumber: selectedContact || "", limit: 500 },
    { enabled: !!user && deviceId > 0 && !!selectedContact, refetchInterval: 10000 }
  );

  // 获取置顶联系人列表
  const { data: pinnedList } = trpc.pinned.list.useQuery(
    { deviceId },
    { enabled: !!user && deviceId > 0 }
  );

  // 置顶联系人号码集合
  const pinnedSet = useMemo(() => {
    if (!pinnedList) return new Set<string>();
    return new Set(pinnedList.map(p => p.phoneNumber));
  }, [pinnedList]);

  // 置顶操作
  const pinMutation = trpc.pinned.pin.useMutation({
    onSuccess: () => {
      utils.pinned.list.invalidate({ deviceId });
      toast.success("已置顶");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const unpinMutation = trpc.pinned.unpin.useMutation({
    onSuccess: () => {
      utils.pinned.list.invalidate({ deviceId });
      toast.success("已取消置顶");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleTogglePin = (phoneNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedSet.has(phoneNumber)) {
      unpinMutation.mutate({ deviceId, phoneNumber });
    } else {
      pinMutation.mutate({ deviceId, phoneNumber });
    }
  };

  // 同步历史短信
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSmsMutation = trpc.syncSms.trigger.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "同步请求已发送，等待手机端响应...");
      setSyncingHistory(true);
      // 安全超时：60秒后如果还没收到 sms_sync_progress，自动停止旋转并刷新
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        setSyncingHistory(false);
        refetchContacts();
        refetchMessages();
      }, 60000);
    },
    onError: (err) => {
      toast.error("同步失败：" + err.message);
      setSyncingHistory(false);
    },
  });

  // 当收到 sms_sync_progress 时清除超时定时器
  useEffect(() => {
    if (!syncingHistory && syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, [syncingHistory]);

  const handleSyncHistory = () => {
    if (!device?.isOnline) {
      toast.error("设备不在线，无法同步");
      return;
    }
    setSyncingHistory(true);
    syncSmsMutation.mutate({ deviceId });
  };

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

  // 发送图片 (MMS)
  const sendImageMutation = trpc.sms.sendImage.useMutation({
    onSuccess: (data) => {
      if (data.sendResult.success) {
        toast.success("图片已发出");
        refetchMessages();
      } else {
        toast.error("图片发送失败：" + (data.sendResult.error || "未知错误"));
        refetchMessages();
      }
    },
    onError: (err) => {
      toast.error("图片发送失败：" + err.message);
    },
  });

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedContact.trim()) {
      toast.error("请先选择联系人");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("图片大小不能超过 1MB（MMS 限制）");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      sendImageMutation.mutate({
        deviceId,
        phoneNumber: selectedContact.trim(),
        imageBase64: base64,
        mimeType: file.type || "image/jpeg",
        body: messageBody.trim() || undefined,
      });
      setMessageBody("");
    };
    reader.readAsDataURL(file);
    // Reset input
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // WebSocket 实时消息
  const { on, isConnected } = useDashboardSocket(user?.id);

  // WebSocket 重连后自动刷新消息和联系人列表（补发丢失的消息）
  const prevConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected && !prevConnectedRef.current && deviceId > 0) {
      // 从断开到重新连接，自动刷新数据
      console.log("[Chat] WebSocket reconnected, refreshing data...");
      refetchContacts();
      if (selectedContact) {
        refetchMessages();
      }
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, deviceId, selectedContact, refetchContacts, refetchMessages]);

  useEffect(() => {
    const unsub1 = on("new_sms", (data: any) => {
      if (data.message?.deviceId === deviceId || data.deviceId === deviceId) {
        refetchMessages();
        refetchContacts();
        // 如果没有选中联系人，自动选中来信号码
        if (!selectedContact && data.message?.phoneNumber) {
          setSelectedContact(data.message.phoneNumber);
        }
      }
    });

    const unsub2 = on("sms_status_update", (data: any) => {
      if (data.deviceId === deviceId) {
        refetchMessages();
        refetchContacts();
      }
    });

    const unsub3 = on("device_log", (data: any) => {
      // Show logs from the current device
      if (data.deviceId) {
        const deviceObj = device as any;
        if (deviceObj && data.deviceId === deviceObj.deviceId) {
          setDeviceLogs(prev => [...prev.slice(-200), {
            level: data.level || "info",
            tag: data.tag || "Device",
            message: data.message || "",
            timestamp: data.timestamp || Date.now(),
          }]);
        }
      }
    });

    // 监听历史短信同步进度
    const unsub4 = on("sms_sync_progress", (data: any) => {
      // deviceId 可能是 string ("dev_xxx") 或 numericDeviceId 是 int
      const matchesDevice = 
        data.numericDeviceId === deviceId || 
        data.deviceId === (device as any)?.deviceId ||
        data.deviceId === String(deviceId);
      if (matchesDevice) {
        setSyncingHistory(false);
        refetchContacts();
        refetchMessages();
        toast.success(`历史短信同步完成：导入 ${data.imported || 0} 条，共 ${data.total || 0} 条`);
      }
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, deviceId, selectedContact, refetchMessages, refetchContacts, device]);

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

  // 已读联系人记录 - 从数据库持久化读取
  const { data: dbReadStatus } = trpc.sms.readStatus.useQuery(
    { deviceId },
    { enabled: !!user && deviceId > 0 }
  );

  // 本地临时已读缓存（用于即时UI反馈，合并数据库数据）
  const [localReadCache, setLocalReadCache] = useState<Record<string, number>>({});

  // 合并数据库已读状态和本地缓存（取较大的时间戳）
  const readTimestamps = useMemo(() => {
    const merged: Record<string, number> = {};
    if (dbReadStatus) {
      Object.entries(dbReadStatus).forEach(([phone, ts]) => {
        merged[phone] = ts as number;
      });
    }
    Object.entries(localReadCache).forEach(([phone, ts]) => {
      if (!merged[phone] || ts > merged[phone]) {
        merged[phone] = ts;
      }
    });
    return merged;
  }, [dbReadStatus, localReadCache]);

  // 一次性迁移：将 localStorage 中的旧数据迁移到数据库
  const batchMarkReadMutation = trpc.sms.batchMarkRead.useMutation();
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!user || deviceId <= 0 || migratedRef.current) return;
    migratedRef.current = true;
    try {
      const stored = localStorage.getItem(`sms_contact_read_${deviceId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const entries = Object.entries(parsed).map(([phoneNumber, lastReadAt]) => ({ phoneNumber, lastReadAt }));
        if (entries.length > 0) {
          batchMarkReadMutation.mutate({ deviceId, entries }, {
            onSuccess: () => {
              // 迁移成功后删除 localStorage 数据
              localStorage.removeItem(`sms_contact_read_${deviceId}`);
              utils.sms.readStatus.invalidate({ deviceId });
            },
          });
        }
      }
    } catch {}
  }, [user, deviceId]);

  // 标记联系人已读 - 写入数据库
  const markReadMutation = trpc.sms.markRead.useMutation({
    onSuccess: () => {
      utils.sms.readStatus.invalidate({ deviceId });
    },
  });

  const markContactRead = useCallback((phoneNumber: string) => {
    const now = Date.now();
    // 即时更新本地缓存（UI立即响应）
    setLocalReadCache(prev => ({ ...prev, [phoneNumber]: now }));
    // 异步写入数据库
    markReadMutation.mutate({ deviceId, phoneNumber, lastReadAt: now });
  }, [deviceId, markReadMutation]);

  // 获取所有联系人（使用独立接口，不受消息条数限制）
  const contacts = useMemo(() => {
    if (!chatContactList) return [];
    // 从后端接口获取完整联系人列表，补充未读数
    const result = chatContactList.map(c => {
      const lastReadTs = readTimestamps[c.phoneNumber] || 0;
      // 未读数：如果最后消息时间 > 已读时间戳，且有收信记录，标记为未读
      const unread = c.hasReplied && c.lastTime > lastReadTs ? 1 : 0;
      return {
        number: c.phoneNumber,
        lastMsg: c.lastMessage || "",
        lastTime: c.lastTime,
        unread,
        name: c.contactName || undefined,
        hasReplied: c.hasReplied,
      };
    });
    // 排序逻辑：置顶 > 未读 > 最后消息时间
    type ContactItem = { number: string; lastMsg: string; lastTime: number; unread: number; name?: string; hasReplied: boolean };
    const sortFn = (a: ContactItem, b: ContactItem) => {
      const aPinned = pinnedSet.has(a.number);
      const bPinned = pinnedSet.has(b.number);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (a.unread > 0 && b.unread === 0) return -1;
      if (a.unread === 0 && b.unread > 0) return 1;
      return b.lastTime - a.lastTime;
    };
    return result.sort(sortFn);
  }, [chatContactList, readTimestamps, pinnedSet]);

  // 分组：已回复 / 未回复
  const repliedContacts = useMemo(() => {
    return contacts.filter(c => c.hasReplied);
  }, [contacts]);

  const unrepliedContacts = useMemo(() => {
    return contacts.filter(c => !c.hasReplied);
  }, [contacts]);

  // 当前激活的分组 tab
  const [activeTab, setActiveTab] = useState<"replied" | "unreplied">("unreplied");

  // 搜索过滤联系人（基于当前分组）
  const filteredContacts = useMemo(() => {
    const base = activeTab === "replied" ? repliedContacts : unrepliedContacts;
    if (!contactSearch.trim()) return base;
    const q = contactSearch.toLowerCase();
    return base.filter(c =>
      c.number.toLowerCase().includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  }, [activeTab, repliedContacts, unrepliedContacts, contactSearch]);

  // 当消息列表加载后，自动选中最近的联系人
  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      setSelectedContact(contacts[0].number);
      markContactRead(contacts[0].number);
    }
  }, [contacts, selectedContact, markContactRead]);

  // 当前联系人的消息（按时间正序）
  const currentMessages = useMemo(() => {
    if (!messageList || !selectedContact) return [];
    return [...messageList].sort((a, b) => a.smsTimestamp - b.smsTimestamp);
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
            <button
              onClick={handleSyncHistory}
              disabled={syncingHistory || syncSmsMutation.isPending}
              className={`p-1.5 rounded transition-colors ${syncingHistory ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/50 hover:text-foreground'} disabled:opacity-50`}
              title="同步历史短信"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingHistory ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowDeviceLogs(v => !v)}
              className={`p-1.5 rounded transition-colors ${showDeviceLogs ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground/50 hover:text-foreground'}`}
              title="设备日志"
            >
              <Terminal className="w-3.5 h-3.5" />
              {deviceLogs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
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

          {/* 分组 Tab */}
          <div className="shrink-0 flex border-b border-foreground/10">
            <button
              onClick={() => setActiveTab("unreplied")}
              className={`flex-1 py-2 text-xs font-serif text-center transition-colors relative ${
                activeTab === "unreplied"
                  ? "text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              未回复
              {unrepliedContacts.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground/50">({unrepliedContacts.length})</span>
              )}
              {activeTab === "unreplied" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-foreground/60" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("replied")}
              className={`flex-1 py-2 text-xs font-serif text-center transition-colors relative ${
                activeTab === "replied"
                  ? "text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              已回复
              {repliedContacts.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground/50">({repliedContacts.length})</span>
              )}
              {activeTab === "replied" && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-foreground/60" />
              )}
            </button>
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
              filteredContacts.map(contact => {
                const isPinned = pinnedSet.has(contact.number);
                return (
                  <button
                    key={contact.number}
                    onClick={() => {
                      setSelectedContact(contact.number);
                      setContactSearch("");
                      markContactRead(contact.number);
                    }}
                    className={`group w-full text-left flex items-center gap-3 px-3 py-3 transition-colors border-b border-foreground/5 ${
                      selectedContact === contact.number
                        ? "bg-foreground/8"
                        : isPinned
                          ? "bg-foreground/[0.03] hover:bg-foreground/6"
                          : "hover:bg-foreground/3"
                    }`}
                  >
                    <div className="relative w-9 h-9 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {/* 未读红点 */}
                      {contact.unread > 0 && selectedContact !== contact.number && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-vermilion text-white text-[10px] font-body font-bold flex items-center justify-center leading-none shadow-sm">
                          {contact.unread > 99 ? "99+" : contact.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-serif truncate ${
                          contact.unread > 0 && selectedContact !== contact.number
                            ? "text-foreground font-bold"
                            : "text-foreground"
                        }`}>
                          {contact.name || contact.number}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {/* 置顶图标（已置顶时常显，未置顶时 hover 显示） */}
                          <span
                            onClick={(e) => handleTogglePin(contact.number, e)}
                            className={`p-0.5 rounded transition-all cursor-pointer ${
                              isPinned
                                ? "text-amber-500/80 hover:text-amber-500"
                                : "text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-muted-foreground/70"
                            }`}
                            title={isPinned ? "取消置顶" : "置顶"}
                          >
                            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                          </span>
                          <span className="text-xs font-body text-muted-foreground/50">
                            {formatShortTime(contact.lastTime)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPinned && (
                          <span className="text-[10px] text-amber-500/60 font-body shrink-0">[置顶]</span>
                        )}
                        <p className={`text-xs font-body truncate mt-0.5 ${
                          contact.unread > 0 && selectedContact !== contact.number
                            ? "text-foreground/70"
                            : "text-muted-foreground/60"
                        }`}>
                          {contact.lastMsg}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
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
            <div className="flex items-center gap-3">
              {selectedContact && (
                <button
                  onClick={(e) => handleTogglePin(selectedContact, e)}
                  className={`flex items-center gap-1 text-xs font-body px-2 py-1 rounded transition-colors border ${
                    pinnedSet.has(selectedContact)
                      ? "text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                      : "text-muted-foreground border-foreground/10 hover:bg-foreground/5"
                  }`}
                >
                  {pinnedSet.has(selectedContact) ? (
                    <><PinOff className="w-3 h-3" /> 取消置顶</>
                  ) : (
                    <><Pin className="w-3 h-3" /> 置顶</>
                  )}
                </button>
              )}
              <div className="text-xs font-body text-muted-foreground/50">
                {currentMessages.length} 条消息
              </div>
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
                          {msg.messageType === "image" && msg.imageUrl ? (
                            <div className="space-y-1">
                              <img
                                src={msg.imageUrl}
                                alt="图片消息"
                                className="max-w-[200px] max-h-[200px] rounded cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setPreviewImage(msg.imageUrl!)}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div className="hidden items-center justify-center w-[200px] h-[100px] bg-foreground/5 rounded text-muted-foreground/40 text-xs">
                                图片加载失败
                              </div>
                              {msg.body && msg.body !== "[图片]" && (
                                <p>{msg.body}</p>
                              )}
                            </div>
                          ) : (
                            msg.body
                          )}
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
            {/* 图片发送按钮 */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              onClick={() => imageInputRef.current?.click()}
              disabled={sendImageMutation.isPending || !selectedContact.trim()}
              variant="outline"
              className="border-foreground/20 text-foreground/60 hover:text-foreground hover:bg-foreground/5 h-10 px-3 shrink-0"
              title="发送图片（MMS）"
            >
              {sendImageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
            </Button>
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
      {/* 设备日志面板 */}
      {showDeviceLogs && (
        <div className="fixed bottom-0 right-0 w-[480px] h-[320px] z-40 bg-card border border-foreground/15 shadow-2xl flex flex-col" style={{borderRadius: '8px 0 0 0'}}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-foreground/5">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-serif text-foreground">设备日志</span>
              <span className="text-xs text-muted-foreground">({deviceLogs.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setDeviceLogs([])} className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-foreground/5">清空</button>
              <button onClick={() => setShowDeviceLogs(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5">
            {deviceLogs.length === 0 ? (
              <div className="text-center text-muted-foreground/50 py-8">等待设备日志...</div>
            ) : deviceLogs.map((log, i) => (
              <div key={i} className={`flex gap-1.5 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-foreground/70'}`}>
                <span className="text-muted-foreground/40 shrink-0">{new Date(log.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                <span className="shrink-0 text-muted-foreground/60">[{log.tag}]</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
      {/* 图片预览模态框 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={previewImage}
              alt="图片预览"
              className="max-w-full max-h-[90vh] object-contain rounded"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
