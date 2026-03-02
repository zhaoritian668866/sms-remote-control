import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Users, Smartphone, MessageSquare, Wifi, Shield, ShieldOff,
  Loader2, Search, Save, KeyRound, ChevronDown, ChevronUp,
  BarChart3, Crown, Settings, Link2, ExternalLink,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

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
    window.location.href = getLoginUrl("/admin");
    return null;
  }

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-body">无权访问管理后台</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <AdminContent />
      </div>
    </DashboardLayout>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<"stats" | "users" | "config">("stats");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-5 h-5 text-foreground/60" />
          <h1 className="text-lg font-serif text-foreground tracking-wider">管理后台</h1>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab("stats")}
            className={`px-4 py-1.5 text-sm font-body tracking-wider rounded transition-colors ${
              tab === "stats"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />
            系统概览
          </button>
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-1.5 text-sm font-body tracking-wider rounded transition-colors ${
              tab === "users"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5" />
            用户管理
          </button>
          <button
            onClick={() => setTab("config")}
            className={`px-4 py-1.5 text-sm font-body tracking-wider rounded transition-colors ${
              tab === "config"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            <Settings className="w-3.5 h-3.5 inline mr-1.5" />
            系统配置
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "stats" && <StatsPanel />}
        {tab === "users" && <UsersPanel />}
        {tab === "config" && <ConfigPanel />}
      </div>
    </div>
  );
}

function StatsPanel() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  const items = [
    { label: "注册用户", value: stats?.totalUsers ?? 0, icon: Users, color: "text-foreground/70" },
    { label: "设备总数", value: stats?.totalDevices ?? 0, icon: Smartphone, color: "text-foreground/70" },
    { label: "在线设备", value: stats?.onlineDevices ?? 0, icon: Wifi, color: "text-green-400/70" },
    { label: "短信总量", value: stats?.totalMessages ?? 0, icon: MessageSquare, color: "text-foreground/70" },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.label} className="relative bg-card/50 border border-foreground/10 p-5">
            {/* 角标 */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />

            <item.icon className={`w-5 h-5 ${item.color} mb-3`} />
            <div className="text-2xl font-serif text-foreground mb-1">{item.value}</div>
            <div className="text-xs font-body text-muted-foreground/50 tracking-wider">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigPanel() {
  const { data: configs, isLoading, refetch } = trpc.admin.getConfigs.useQuery();
  const [serviceLink, setServiceLink] = useState("");

  const setConfigMutation = trpc.admin.setConfig.useMutation({
    onSuccess: () => {
      toast.success("配置已保存");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (configs) {
      const csLink = configs.find((c: any) => c.configKey === "customer_service_link");
      if (csLink?.configValue) {
        setServiceLink(csLink.configValue);
      }
    }
  }, [configs]);

  const handleSaveServiceLink = () => {
    setConfigMutation.mutate({
      key: "customer_service_link",
      value: serviceLink.trim(),
      description: "客服联系链接（微信/QQ/网页等）",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 客服链接配置 */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />

        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-serif text-foreground tracking-wider">客服联系链接</h3>
        </div>
        <p className="text-xs font-body text-muted-foreground/50 mb-4">
          用户设备超限时将显示此链接，引导用户联系客服购买更多设备配额。支持微信链接、QQ链接、网页链接等。
        </p>

        <div className="flex items-center gap-3">
          <Input
            value={serviceLink}
            onChange={e => setServiceLink(e.target.value)}
            placeholder="例如：https://work.weixin.qq.com/kfid/xxx 或 微信号: xxx"
            className="h-9 flex-1 bg-background/60 border-foreground/10 text-sm font-body"
          />
          <Button
            size="sm"
            onClick={handleSaveServiceLink}
            disabled={setConfigMutation.isPending}
            className="h-9 px-4 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
          >
            {setConfigMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            保存
          </Button>
        </div>

        {serviceLink && (
          <div className="mt-3 flex items-center gap-2 text-xs font-body text-muted-foreground/40">
            <ExternalLink className="w-3 h-3" />
            <span>当前链接：</span>
            <span className="text-foreground/60 truncate max-w-md">
              {serviceLink}
            </span>
          </div>
        )}
      </div>

      {/* 配置项列表 */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />

        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-serif text-foreground tracking-wider">配置项列表</h3>
        </div>

        {configs && configs.length > 0 ? (
          <div className="space-y-2">
            {configs.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-background/40 border border-foreground/5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-body text-foreground/70">{c.configKey}</div>
                  <div className="text-xs font-body text-muted-foreground/40 truncate mt-0.5">
                    {c.description || "无描述"}
                  </div>
                </div>
                <div className="text-xs font-body text-foreground/50 max-w-xs truncate ml-4">
                  {c.configValue || "（空）"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground/40 font-body text-sm">
            暂无配置项，保存客服链接后将自动创建
          </div>
        )}
      </div>
    </div>
  );
}

function UsersPanel() {
  const { data: userList, isLoading, refetch } = trpc.admin.users.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    if (!userList) return [];
    if (!searchTerm) return userList;
    const s = searchTerm.toLowerCase();
    return userList.filter(u =>
      u.username?.toLowerCase().includes(s) ||
      u.name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    );
  }, [userList, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 搜索 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="搜索用户名、昵称..."
          className="pl-9 h-9 bg-background/60 border-foreground/10 text-sm font-body"
        />
      </div>

      {/* 用户列表 */}
      <div className="space-y-2">
        {filteredUsers.map(u => (
          <UserRow
            key={u.id}
            user={u}
            isExpanded={expandedId === u.id}
            onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)}
            onRefresh={refetch}
          />
        ))}
        {filteredUsers.length === 0 && (
          <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">
            暂无用户数据
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  isExpanded,
  onToggle,
  onRefresh,
}: {
  user: any;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [maxDevices, setMaxDevices] = useState(String(user.maxDevices ?? 1));
  const [newPassword, setNewPassword] = useState("");

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success("更新成功");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPwdMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密码已重置");
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveQuota = () => {
    const num = parseInt(maxDevices);
    if (isNaN(num) || num < 0 || num > 999) {
      toast.error("请输入 0-999 之间的数字");
      return;
    }
    updateMutation.mutate({ id: user.id, maxDevices: num });
  };

  const handleToggleActive = () => {
    updateMutation.mutate({ id: user.id, isActive: !user.isActive });
  };

  const handleToggleRole = () => {
    updateMutation.mutate({ id: user.id, role: user.role === "admin" ? "user" : "admin" });
  };

  const handleResetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("密码至少6位");
      return;
    }
    resetPwdMutation.mutate({ id: user.id, newPassword });
  };

  return (
    <div className="bg-card/40 border border-foreground/8 overflow-hidden">
      {/* 主行 */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-foreground/5 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-serif text-foreground/60">
            {(user.name || user.username || "?")[0].toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body text-foreground truncate">
              {user.name || user.username}
            </span>
            {user.role === "admin" && (
              <span className="text-[10px] px-1.5 py-0.5 bg-foreground/10 text-foreground/60 font-body rounded">
                管理员
              </span>
            )}
            {!user.isActive && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400/80 font-body rounded">
                已禁用
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground/40 font-body">
            @{user.username} · 设备 {user.deviceCount}/{user.maxDevices}台 · 注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
          </div>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground/30 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground/30 shrink-0" />
        )}
      </button>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-foreground/5 pt-3 space-y-3">
          {/* 设备配额 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">设备配额</label>
            <Input
              value={maxDevices}
              onChange={e => setMaxDevices(e.target.value)}
              className="h-8 w-20 text-sm bg-background/60 border-foreground/10 font-body text-center"
              type="number"
              min={0}
              max={999}
            />
            <span className="text-xs text-muted-foreground/40 font-body">台</span>
            <Button
              size="sm"
              onClick={handleSaveQuota}
              disabled={updateMutation.isPending}
              className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
            >
              <Save className="w-3 h-3 mr-1" />
              保存
            </Button>
          </div>

          {/* 重置密码 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">重置密码</label>
            <Input
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少6位）"
              type="password"
              className="h-8 flex-1 text-sm bg-background/60 border-foreground/10 font-body"
            />
            <Button
              size="sm"
              onClick={handleResetPassword}
              disabled={resetPwdMutation.isPending}
              className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
            >
              <KeyRound className="w-3 h-3 mr-1" />
              重置
            </Button>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleToggleActive}
              disabled={updateMutation.isPending}
              className={`h-8 px-3 text-xs font-body border ${
                user.isActive
                  ? "bg-red-500/10 border-red-500/20 text-red-400/80 hover:bg-red-500/20"
                  : "bg-green-500/10 border-green-500/20 text-green-400/80 hover:bg-green-500/20"
              }`}
            >
              {user.isActive ? (
                <><ShieldOff className="w-3 h-3 mr-1" />禁用账户</>
              ) : (
                <><Shield className="w-3 h-3 mr-1" />启用账户</>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleToggleRole}
              disabled={updateMutation.isPending}
              className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
            >
              <Crown className="w-3 h-3 mr-1" />
              {user.role === "admin" ? "取消管理员" : "设为管理员"}
            </Button>
          </div>

          {/* 详细信息 */}
          <div className="text-xs text-muted-foreground/30 font-body pt-1 space-y-0.5">
            <div>最后登录：{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("zh-CN") : "从未"}</div>
            <div>邮箱：{user.email || "未设置"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
