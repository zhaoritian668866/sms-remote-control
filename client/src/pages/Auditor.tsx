import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Users, MessageSquare, Loader2, Search, Shield,
  BarChart3, Eye, FileDown, Filter, Download,
  Check, Square, CheckSquare, Smartphone, Wifi,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function Auditor() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/auditor");
    return null;
  }

  if (user?.role !== "auditor" && user?.role !== "superadmin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-body">无权访问审计台（仅审计员可用）</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <AuditorContent />
      </div>
    </DashboardLayout>
  );
}

function AuditorContent() {
  const [tab, setTab] = useState<"stats" | "users" | "messages" | "export">("stats");

  const tabs = [
    { key: "stats" as const, label: "系统概览", icon: BarChart3 },
    { key: "users" as const, label: "全部用户", icon: Users },
    { key: "messages" as const, label: "全部记录", icon: MessageSquare },
    { key: "export" as const, label: "号码导出", icon: FileDown },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5 text-foreground/60" />
          <h1 className="text-lg font-serif text-foreground tracking-wider">审计台</h1>
          <span className="text-[10px] px-2 py-0.5 bg-foreground/10 text-foreground/50 font-body rounded">审计员</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-body transition-all ${
                tab === t.key
                  ? "bg-foreground/10 text-foreground border border-foreground/20"
                  : "text-foreground/40 hover:text-foreground/60 hover:bg-foreground/5"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "stats" && <StatsPanel />}
        {tab === "users" && <UsersPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "export" && <ExportPanel />}
      </div>
    </div>
  );
}

// ─── Stats Panel ───
function StatsPanel() {
  const { data: stats, isLoading } = trpc.auditor.stats.useQuery();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  const cards = [
    { label: "用户总数", value: stats?.totalUsers ?? 0, icon: Users },
    { label: "设备总数", value: stats?.totalDevices ?? 0, icon: Smartphone },
    { label: "在线设备", value: stats?.onlineDevices ?? 0, icon: Wifi },
    { label: "短信总量", value: stats?.totalMessages ?? 0, icon: MessageSquare },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="ink-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <c.icon className="w-4 h-4 text-foreground/40" />
            <span className="text-xs text-foreground/50 font-body">{c.label}</span>
          </div>
          <p className="text-2xl font-display text-foreground">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Users Panel (read-only) ───
function UsersPanel() {
  const { data: userList, isLoading } = trpc.auditor.allUsers.useQuery();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!userList) return [];
    if (!search) return userList;
    const s = search.toLowerCase();
    return userList.filter(u =>
      (u.name?.toLowerCase().includes(s)) ||
      (u.username?.toLowerCase().includes(s)) ||
      (u.groupName?.toLowerCase().includes(s))
    );
  }, [userList, search]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <Input
            placeholder="搜索用户..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-foreground/5 border-foreground/10 text-foreground font-body text-sm"
          />
        </div>
        <span className="text-xs text-foreground/40 font-body">共 {filtered.length} 人</span>
      </div>

      <div className="ink-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">用户名</th>
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">昵称</th>
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">角色</th>
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">用户组</th>
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">设备数</th>
                <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">状态</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-foreground/5 hover:bg-foreground/3">
                  <td className="px-4 py-3 text-foreground font-body">@{u.username || "-"}</td>
                  <td className="px-4 py-3 text-foreground font-body">{u.name || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-body ${
                      u.role === "superadmin" ? "bg-amber-500/10 text-amber-400" :
                      u.role === "admin" ? "bg-blue-500/10 text-blue-400" :
                      u.role === "auditor" ? "bg-purple-500/10 text-purple-400" :
                      "bg-foreground/5 text-foreground/50"
                    }`}>
                      {u.role === "superadmin" ? "超管" : u.role === "admin" ? "主管" : u.role === "auditor" ? "审计" : "一线"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/60 font-body text-xs">{u.groupName || "-"}</td>
                  <td className="px-4 py-3 text-foreground font-body">{u.deviceCount}/{u.maxDevices}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-body ${
                      u.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {u.isActive ? "正常" : "禁用"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Messages Panel (read-only) ───
function MessagesPanel() {
  const { data: groups } = trpc.auditor.groups.useQuery();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data: messages, isLoading } = trpc.auditor.messages.useQuery({
    search: search || undefined,
    groupId,
    limit,
    offset,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <Input
            placeholder="搜索号码或内容..."
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0); }}
            className="pl-9 bg-foreground/5 border-foreground/10 text-foreground font-body text-sm"
          />
        </div>
        <select
          value={groupId ?? ""}
          onChange={e => { setGroupId(e.target.value ? Number(e.target.value) : undefined); setOffset(0); }}
          className="px-3 py-2 rounded bg-foreground/5 border border-foreground/10 text-foreground font-body text-xs"
        >
          <option value="">全部用户组</option>
          {groups?.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>
      ) : (
        <div className="ink-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10">
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">方向</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">号码</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">内容</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">状态</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">时间</th>
                </tr>
              </thead>
              <tbody>
                {messages && messages.length > 0 ? messages.map((m: any) => (
                  <tr key={m.id} className="border-b border-foreground/5 hover:bg-foreground/3">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-body ${
                        m.direction === "outgoing" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {m.direction === "outgoing" ? "发出" : "收到"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground font-body text-xs">{m.phoneNumber}</td>
                    <td className="px-4 py-3 text-foreground/70 font-body text-xs max-w-[300px] truncate">{m.body}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-body ${
                        m.status === "sent" || m.status === "delivered" ? "bg-emerald-500/10 text-emerald-400" :
                        m.status === "failed" ? "bg-red-500/10 text-red-400" :
                        "bg-foreground/5 text-foreground/50"
                      }`}>
                        {m.status === "sent" ? "已发" : m.status === "delivered" ? "送达" : m.status === "failed" ? "失败" : m.status === "pending" ? "待发" : "收到"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/40 font-body text-xs whitespace-nowrap">
                      {new Date(m.smsTimestamp).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-foreground/30 font-body text-sm">暂无记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {messages && messages.length >= limit && (
            <div className="flex justify-center py-3 border-t border-foreground/5">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="text-xs font-body border-foreground/10 text-foreground/60"
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  className="text-xs font-body border-foreground/10 text-foreground/60"
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export Panel ───
function ExportPanel() {
  const { data: groups } = trpc.auditor.groups.useQuery();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing" | "">("");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());

  const startTime = startDate ? new Date(startDate).getTime() : undefined;
  const endTime = endDate ? new Date(endDate + "T23:59:59").getTime() : undefined;

  const { data: numbers, isLoading } = trpc.auditor.exportNumbers.useQuery({
    startTime,
    endTime,
    direction: direction || undefined,
    groupId,
  });

  const allSelected = numbers && numbers.length > 0 && selectedNumbers.size === numbers.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedNumbers(new Set());
    } else if (numbers) {
      setSelectedNumbers(new Set(numbers.map((n: any) => n.phoneNumber)));
    }
  };

  const toggleOne = (phone: string) => {
    const next = new Set(selectedNumbers);
    if (next.has(phone)) next.delete(phone);
    else next.add(phone);
    setSelectedNumbers(next);
  };

  const exportCSV = () => {
    const toExport = numbers?.filter((n: any) => selectedNumbers.has(n.phoneNumber)) || [];
    if (toExport.length === 0) {
      toast.error("请先选择要导出的号码");
      return;
    }
    const csv = "手机号,联系人,消息数\n" + toExport.map((n: any) => `${n.phoneNumber},${n.contactName || ""},${n.messageCount}`).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `号码导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${toExport.length} 个号码`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground/40" />
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-36 bg-foreground/5 border-foreground/10 text-foreground font-body text-xs"
          />
          <span className="text-foreground/30 text-xs">至</span>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-36 bg-foreground/5 border-foreground/10 text-foreground font-body text-xs"
          />
        </div>
        <select
          value={direction}
          onChange={e => setDirection(e.target.value as any)}
          className="px-3 py-2 rounded bg-foreground/5 border border-foreground/10 text-foreground font-body text-xs"
        >
          <option value="">全部方向</option>
          <option value="outgoing">仅发出</option>
          <option value="incoming">仅收到</option>
        </select>
        <select
          value={groupId ?? ""}
          onChange={e => setGroupId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-2 rounded bg-foreground/5 border border-foreground/10 text-foreground font-body text-xs"
        >
          <option value="">全部用户组</option>
          {groups?.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <Button
          onClick={exportCSV}
          disabled={selectedNumbers.size === 0}
          size="sm"
          className="bg-foreground/10 text-foreground hover:bg-foreground/15 font-body text-xs border border-foreground/20"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          导出 ({selectedNumbers.size})
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>
      ) : (
        <div className="ink-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-foreground/50 hover:text-foreground">
                      {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">手机号</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">联系人</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-body font-normal text-xs">消息数</th>
                </tr>
              </thead>
              <tbody>
                {numbers && numbers.length > 0 ? numbers.map((n: any) => (
                  <tr key={n.phoneNumber} className="border-b border-foreground/5 hover:bg-foreground/3">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleOne(n.phoneNumber)} className="text-foreground/50 hover:text-foreground">
                        {selectedNumbers.has(n.phoneNumber) ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-foreground font-body text-xs">{n.phoneNumber}</td>
                    <td className="px-4 py-3 text-foreground/60 font-body text-xs">{n.contactName || "-"}</td>
                    <td className="px-4 py-3 text-foreground font-body text-xs">{n.messageCount}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-foreground/30 font-body text-sm">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
