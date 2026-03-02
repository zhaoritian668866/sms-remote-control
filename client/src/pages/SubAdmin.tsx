import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Users, Smartphone, MessageSquare, Wifi, Shield, ShieldOff,
  Loader2, Search, Save, KeyRound, ChevronDown, ChevronUp,
  BarChart3, Building2, Layers, Hash,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function SubAdmin() {
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
    window.location.href = getLoginUrl("/sub-admin");
    return null;
  }

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-body">无权访问子后台（仅主管可用）</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <SubAdminContent />
      </div>
    </DashboardLayout>
  );
}

function SubAdminContent() {
  const [tab, setTab] = useState<"stats" | "users" | "messages" | "devices">("stats");

  const tabs = [
    { key: "stats" as const, label: "概览", icon: BarChart3 },
    { key: "users" as const, label: "一线人员", icon: Users },
    { key: "devices" as const, label: "设备列表", icon: Smartphone },
    { key: "messages" as const, label: "聊天记录", icon: MessageSquare },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-foreground/60" />
          <h1 className="text-lg font-serif text-foreground tracking-wider">子后台</h1>
          <span className="text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400/80 font-body rounded">主管</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 text-sm font-body tracking-wider rounded transition-colors ${
                tab === t.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5 inline mr-1.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "stats" && <SubStatsPanel />}
        {tab === "users" && <SubUsersPanel />}
        {tab === "devices" && <SubDevicesPanel />}
        {tab === "messages" && <SubMessagesPanel />}
      </div>
    </div>
  );
}

function SubStatsPanel() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: group, isLoading: groupLoading } = trpc.admin.myGroup.useQuery();

  if (isLoading || groupLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  const items = [
    { label: "一线人员", value: stats?.totalUsers ?? 0, icon: Users },
    { label: "设备总数", value: stats?.totalDevices ?? 0, icon: Smartphone },
    { label: "在线设备", value: stats?.onlineDevices ?? 0, icon: Wifi },
    { label: "短信总量", value: stats?.totalMessages ?? 0, icon: MessageSquare },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Group info */}
      {group && (
        <div className="relative bg-card/50 border border-foreground/10 p-5">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="w-5 h-5 text-foreground/60" />
            <span className="text-base font-serif text-foreground tracking-wider">{group.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm font-body">
            <div>
              <span className="text-muted-foreground/50">标识码：</span>
              <code className="text-foreground/70 bg-background/60 px-1.5 py-0.5 border border-foreground/10 text-xs">{group.groupCode}</code>
            </div>
            <div>
              <span className="text-muted-foreground/50">设备配额：</span>
              <span className="text-foreground/70">{group.allocatedDevices}/{group.maxDevices} 台</span>
            </div>
            <div>
              <span className="text-muted-foreground/50">剩余可分配：</span>
              <span className="text-foreground/70">{group.maxDevices - group.allocatedDevices} 台</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.label} className="relative bg-card/50 border border-foreground/10 p-5">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
            <item.icon className="w-5 h-5 text-foreground/70 mb-3" />
            <div className="text-2xl font-serif text-foreground mb-1">{item.value}</div>
            <div className="text-xs font-body text-muted-foreground/50 tracking-wider">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubUsersPanel() {
  const { data: userList, isLoading, refetch } = trpc.admin.users.useQuery();
  const { data: group } = trpc.admin.myGroup.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    if (!userList) return [];
    if (!searchTerm) return userList;
    const s = searchTerm.toLowerCase();
    return userList.filter((u: any) =>
      u.username?.toLowerCase().includes(s) ||
      u.name?.toLowerCase().includes(s)
    );
  }, [userList, searchTerm]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6">
      {group && (
        <div className="text-xs font-body text-muted-foreground/40 mb-3">
          组配额：{group.allocatedDevices}/{group.maxDevices} 台已分配 · 剩余可分配 {group.maxDevices - group.allocatedDevices} 台
        </div>
      )}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索用户名、昵称..." className="pl-9 h-9 bg-background/60 border-foreground/10 text-sm font-body" />
      </div>
      <div className="space-y-2">
        {filteredUsers.map((u: any) => (
          <SubUserRow key={u.id} user={u} isExpanded={expandedId === u.id} onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)} onRefresh={refetch} />
        ))}
        {filteredUsers.length === 0 && <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">暂无一线人员</div>}
      </div>
    </div>
  );
}

function SubUserRow({ user, isExpanded, onToggle, onRefresh }: { user: any; isExpanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const [maxDevices, setMaxDevices] = useState(String(user.maxDevices ?? 1));
  const [newPassword, setNewPassword] = useState("");

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success("更新成功"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const resetPwdMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => { toast.success("密码已重置"); setNewPassword(""); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="bg-card/40 border border-foreground/8 overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-foreground/5 transition-colors text-left">
        <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-serif text-foreground/60">{(user.name || user.username || "?")[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body text-foreground truncate">{user.name || user.username}</span>
            {!user.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400/80 font-body rounded">已禁用</span>}
          </div>
          <div className="text-xs text-muted-foreground/40 font-body">
            @{user.username} · 设备 {user.deviceCount}/{user.maxDevices}台
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-foreground/5 pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">设备配额</label>
            <Input value={maxDevices} onChange={e => setMaxDevices(e.target.value)} className="h-8 w-20 text-sm bg-background/60 border-foreground/10 font-body text-center" type="number" min={0} />
            <span className="text-xs text-muted-foreground/40 font-body">台</span>
            <Button size="sm" onClick={() => updateMutation.mutate({ id: user.id, maxDevices: parseInt(maxDevices) || 0 })} disabled={updateMutation.isPending} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              <Save className="w-3 h-3 mr-1" />保存
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">重置密码</label>
            <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入新密码（至少6位）" type="password" className="h-8 flex-1 text-sm bg-background/60 border-foreground/10 font-body" />
            <Button size="sm" onClick={() => resetPwdMutation.mutate({ id: user.id, newPassword })} disabled={resetPwdMutation.isPending || newPassword.length < 6} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              <KeyRound className="w-3 h-3 mr-1" />重置
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => updateMutation.mutate({ id: user.id, isActive: !user.isActive })} disabled={updateMutation.isPending}
              className={`h-8 px-3 text-xs font-body border ${user.isActive ? "bg-red-500/10 border-red-500/20 text-red-400/80 hover:bg-red-500/20" : "bg-green-500/10 border-green-500/20 text-green-400/80 hover:bg-green-500/20"}`}>
              {user.isActive ? <><ShieldOff className="w-3 h-3 mr-1" />禁用</> : <><Shield className="w-3 h-3 mr-1" />启用</>}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground/30 font-body pt-1">
            最后登录：{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("zh-CN") : "从未"}
          </div>
        </div>
      )}
    </div>
  );
}

function SubDevicesPanel() {
  const { data: deviceList, isLoading } = trpc.admin.devices.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6">
      <div className="space-y-2">
        {deviceList?.map((d: any) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-card/40 border border-foreground/8">
            <div className={`w-2 h-2 rounded-full shrink-0 ${d.isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
            <Smartphone className="w-4 h-4 text-foreground/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-body text-foreground truncate">{d.name}</div>
              <div className="text-xs text-muted-foreground/40 font-body">
                {d.phoneModel || "未知型号"} · 使用者: {d.ownerName} · {d.phoneNumber || "未知号码"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground/30 font-body shrink-0">
              {d.batteryLevel != null ? `${d.batteryLevel}%` : ""}
            </div>
          </div>
        ))}
        {(!deviceList || deviceList.length === 0) && <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">暂无设备</div>}
      </div>
    </div>
  );
}

function SubMessagesPanel() {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const startTime = startDate ? new Date(startDate).getTime() : undefined;
  const endTime = endDate ? new Date(endDate + "T23:59:59").getTime() : undefined;

  const { data: msgs, isLoading } = trpc.admin.messages.useQuery({
    search: search || undefined,
    startTime,
    endTime,
    limit: 200,
  });

  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索号码、内容..." className="pl-9 h-9 bg-background/60 border-foreground/10 text-sm font-body" />
        </div>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-36 bg-background/60 border-foreground/10 text-sm font-body" />
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-36 bg-background/60 border-foreground/10 text-sm font-body" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>
      ) : (
        <div className="space-y-1">
          {msgs?.map((m: any) => (
            <div key={m.id} className="flex items-start gap-3 px-3 py-2 bg-card/30 border border-foreground/5 text-sm">
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${m.direction === "incoming" ? "bg-blue-500/20 text-blue-400/80" : "bg-green-500/20 text-green-400/80"}`}>
                {m.direction === "incoming" ? "收" : "发"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/50 font-body">
                  <span>{m.phoneNumber}</span>
                  <span>·</span>
                  <span>{new Date(Number(m.smsTimestamp)).toLocaleString("zh-CN")}</span>
                </div>
                <div className="text-foreground/80 font-body mt-0.5 break-all">{m.body}</div>
              </div>
            </div>
          ))}
          {(!msgs || msgs.length === 0) && <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">暂无消息记录</div>}
        </div>
      )}
    </div>
  );
}
