import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Smartphone, Phone, Search, ChevronLeft, ChevronRight, Calendar,
  MessageSquare, ArrowLeft, Filter, X
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

// ─── Date helpers ───
function getDateRange(date: Date): { startTime: number; endTime: number } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { startTime: start.getTime(), endTime: end.getTime() };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ChatRecords() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // ─── State ───
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [searchDevice, setSearchDevice] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const { startTime, endTime } = useMemo(() => getDateRange(selectedDate), [selectedDate]);

  // ─── Queries ───
  const devicesQuery = trpc.chatRecords.devices.useQuery(undefined, {
    enabled: !!user && (user.role === "admin" || user.role === "superadmin" || user.role === "auditor"),
  });

  const contactsQuery = trpc.chatRecords.contacts.useQuery(
    { deviceId: selectedDeviceId!, startTime, endTime },
    { enabled: !!selectedDeviceId }
  );

  const messagesQuery = trpc.chatRecords.messages.useQuery(
    { deviceId: selectedDeviceId!, phoneNumber: selectedContact!, startTime, endTime },
    { enabled: !!selectedDeviceId && !!selectedContact }
  );

  // ─── Derived data ───
  const devices = devicesQuery.data || [];
  const contacts = contactsQuery.data || [];
  const currentMessages = messagesQuery.data || [];

  // Group devices by group for superadmin/auditor
  const groups = useMemo(() => {
    const groupMap = new Map<string, typeof devices>();
    for (const d of devices) {
      const key = d.groupName || "未分组";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(d);
    }
    return Array.from(groupMap.entries()).map(([name, devs]) => ({
      name,
      groupId: devs[0]?.groupId,
      devices: devs,
    }));
  }, [devices]);

  // Filter devices
  const filteredDevices = useMemo(() => {
    let devs = devices;
    if (selectedGroupId !== null) {
      devs = devs.filter(d => d.groupId === selectedGroupId);
    }
    if (searchDevice.trim()) {
      const q = searchDevice.toLowerCase();
      devs = devs.filter(d =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.ownerName || "").toLowerCase().includes(q) ||
        (d.phoneNumber || "").toLowerCase().includes(q)
      );
    }
    return devs;
  }, [devices, selectedGroupId, searchDevice]);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchContact.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchContact]);

  // Search contacts by keyword (name, phone, or message content)
  const searchQuery = trpc.chatRecords.searchContacts.useQuery(
    { deviceId: selectedDeviceId!, startTime, endTime, keyword: debouncedSearch },
    { enabled: !!selectedDeviceId && debouncedSearch.length > 0 }
  );

  // Filter contacts: use search API results when keyword is present, otherwise show all
  const filteredContacts = useMemo(() => {
    if (debouncedSearch.length > 0 && searchQuery.data) {
      return searchQuery.data;
    }
    return contacts;
  }, [contacts, debouncedSearch, searchQuery.data]);

  // Reset contact when device changes
  useEffect(() => {
    setSelectedContact(null);
    setSearchContact("");
  }, [selectedDeviceId]);

  // Reset contact when date changes
  useEffect(() => {
    setSelectedContact(null);
  }, [selectedDate]);

  // ─── Date navigation ───
  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date();
    if (d <= today) setSelectedDate(d);
  };
  const isToday = formatDateInput(selectedDate) === formatDateInput(new Date());

  // ─── Message helpers ───
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };
  const shouldShowTime = (index: number) => {
    if (index === 0) return true;
    const prev = currentMessages[index - 1];
    const curr = currentMessages[index];
    return curr.smsTimestamp - prev.smsTimestamp > 5 * 60 * 1000;
  };
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

  if (!user || (user.role !== "admin" && user.role !== "superadmin" && user.role !== "auditor")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">无权访问此页面</p>
        </div>
      </DashboardLayout>
    );
  }

  const isSuperOrAuditor = user.role === "superadmin" || user.role === "auditor";
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <DashboardLayout>
      <div className="flex h-full overflow-hidden bg-background">
        {/* ─── 左侧：信使选择 ─── */}
        <div className="w-[240px] shrink-0 border-r border-foreground/10 flex flex-col bg-card/30">
          {/* 标题 */}
          <div className="shrink-0 px-3 py-3 border-b border-foreground/10">
            <h2 className="text-sm font-serif font-semibold text-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              选择信使
            </h2>
          </div>

          {/* 分组筛选（仅超管/审计员） */}
          {isSuperOrAuditor && groups.length > 1 && (
            <div className="shrink-0 px-2 py-2 border-b border-foreground/10">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedGroupId(null)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    selectedGroupId === null
                      ? "bg-jade/20 text-jade border border-jade/30"
                      : "text-muted-foreground hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  全部
                </button>
                {groups.map(g => (
                  <button
                    key={g.name}
                    onClick={() => setSelectedGroupId(g.groupId)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedGroupId === g.groupId
                        ? "bg-jade/20 text-jade border border-jade/30"
                        : "text-muted-foreground hover:bg-foreground/5 border border-transparent"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 搜索信使 */}
          <div className="shrink-0 px-2 py-2 border-b border-foreground/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                value={searchDevice}
                onChange={e => setSearchDevice(e.target.value)}
                placeholder="搜索信使..."
                className="h-8 pl-8 text-xs bg-background/50 border-foreground/10"
              />
            </div>
          </div>

          {/* 信使列表 */}
          <div className="flex-1 overflow-y-auto">
            {devicesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs text-muted-foreground">加载中...</div>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs text-muted-foreground">暂无信使</div>
              </div>
            ) : (
              filteredDevices.map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeviceId(d.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-foreground/5 transition-colors ${
                    selectedDeviceId === d.id
                      ? "bg-jade/10 border-l-2 border-l-jade"
                      : "hover:bg-foreground/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground truncate">
                        {d.name || d.deviceId}
                      </div>
                      <div className="text-xs text-muted-foreground/60 truncate">
                        {d.ownerName}{isSuperOrAuditor && d.groupName ? ` · ${d.groupName}` : ""}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ─── 中间：联系人列表 ─── */}
        <div className="w-[260px] shrink-0 border-r border-foreground/10 flex flex-col bg-card/20">
          {/* 日期选择器 */}
          <div className="shrink-0 px-3 py-2.5 border-b border-foreground/10 flex items-center justify-between">
            <button onClick={prevDay} className="p-1 hover:bg-foreground/5 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={formatDateInput(selectedDate)}
                onChange={e => {
                  const d = new Date(e.target.value + "T00:00:00");
                  if (!isNaN(d.getTime())) setSelectedDate(d);
                }}
                max={formatDateInput(new Date())}
                className="text-xs font-body text-foreground bg-transparent border-none outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={nextDay}
              disabled={isToday}
              className={`p-1 rounded transition-colors ${isToday ? "opacity-30 cursor-not-allowed" : "hover:bg-foreground/5"}`}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* 设备信息 */}
          {selectedDevice && (
            <div className="shrink-0 px-3 py-2 border-b border-foreground/10 bg-card/40">
              <div className="text-xs font-medium text-foreground">{selectedDevice.name || selectedDevice.deviceId}</div>
              <div className="text-xs text-muted-foreground/60 mt-0.5">
                {selectedDevice.phoneNumber || "未知号码"} · {selectedDevice.ownerName}
              </div>
            </div>
          )}

          {/* 搜索联系人 */}
          {selectedDeviceId && (
            <div className="shrink-0 px-2 py-2 border-b border-foreground/10">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                <Input
                  value={searchContact}
                  onChange={e => setSearchContact(e.target.value)}
                  placeholder="搜索联系人/手机号/聊天内容..."
                  className="h-8 pl-8 text-xs bg-background/50 border-foreground/10"
                />
              </div>
            </div>
          )}

          {/* 联系人列表 */}
          <div className="flex-1 overflow-y-auto">
            {!selectedDeviceId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Smartphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">请先选择信使</p>
                </div>
              </div>
            ) : contactsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs text-muted-foreground">加载中...</div>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground/50">
                    {formatDate(selectedDate)} 无聊天记录
                  </p>
                </div>
              </div>
            ) : (
              filteredContacts.map(c => (
                <button
                  key={c.phoneNumber}
                  onClick={() => setSelectedContact(c.phoneNumber)}
                  className={`w-full text-left px-3 py-2.5 border-b border-foreground/5 transition-colors ${
                    selectedContact === c.phoneNumber
                      ? "bg-jade/10 border-l-2 border-l-jade"
                      : "hover:bg-foreground/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-sm bg-foreground/5 border border-foreground/10 flex items-center justify-center shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {c.contactName?.charAt(0) || c.phoneNumber.slice(-2)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate">
                          {c.contactName || c.phoneNumber}
                        </span>
                        <span className="text-xs text-muted-foreground/40 shrink-0 ml-1">
                          {c.totalMessages}条
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground/50 truncate mt-0.5">
                        {c.lastMessage || "无消息"}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-jade/60">↑{c.outgoingCount}</span>
                        <span className="text-xs text-blue-400/60">↓{c.incomingCount}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 联系人统计 */}
          {selectedDeviceId && contacts.length > 0 && (
            <div className="shrink-0 px-3 py-2 border-t border-foreground/10 bg-card/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                <span>{contacts.length} 个联系人</span>
                <span>
                  共 {contacts.reduce((s, c) => s + c.totalMessages, 0)} 条消息
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ─── 右侧：消息展示 ─── */}
        <div className="flex-1 flex flex-col">
          {/* 对话头部 */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-card/80 border-b border-foreground/10">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-serif text-sm text-foreground">
                {selectedContact || "请选择联系人"}
              </span>
              {selectedContact && filteredContacts.find(c => c.phoneNumber === selectedContact)?.contactName && (
                <span className="text-xs font-body text-muted-foreground">
                  ({filteredContacts.find(c => c.phoneNumber === selectedContact)?.contactName})
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-body text-muted-foreground/50">
                {currentMessages.length} 条消息
              </div>
              <div className="text-xs font-body text-muted-foreground/40">
                {formatDate(selectedDate)}
              </div>
            </div>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-background/50">
            {!selectedContact ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4 opacity-15">📜</div>
                  <p className="text-sm font-body text-muted-foreground">请从左侧选择联系人查看聊天记录</p>
                  <p className="text-xs font-body text-muted-foreground/50 mt-1">
                    选择信使 → 选择日期 → 选择联系人
                  </p>
                </div>
              </div>
            ) : messagesQuery.isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-muted-foreground">加载消息中...</div>
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-4 opacity-15">✉</div>
                  <p className="text-sm font-body text-muted-foreground">
                    {formatDate(selectedDate)} 无与 {selectedContact} 的消息
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
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
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
                      {/* 发信头像 */}
                      {msg.direction === "outgoing" && (
                        <div className="w-8 h-8 rounded-sm bg-jade/10 border border-jade/20 flex items-center justify-center shrink-0 mb-1">
                          <span className="text-xs font-body text-jade">我</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* 底部提示 */}
          <div className="shrink-0 px-4 py-2 border-t border-foreground/10 bg-card/40">
            <p className="text-xs text-muted-foreground/40 text-center">
              仅查看模式 · {formatDate(selectedDate)} 0:00 - 23:59
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
