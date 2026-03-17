import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Users, Smartphone, MessageSquare, Wifi, Shield, ShieldOff,
  Loader2, Search, Save, KeyRound, ChevronDown, ChevronUp,
  BarChart3, Crown, Settings, Link2, ExternalLink, Plus,
  Building2, Hash, Copy, Eye, EyeOff, Layers, Bot, Zap,
  CheckCircle2, XCircle, AlertTriangle, BookOpen, RefreshCw,
  Brain, Database, TrendingUp, MessageCircle, Trash2, History,
  Send, Sparkles, Clock, Timer, FileText, GraduationCap, Play,
  LogOut, Power, Signal, Monitor,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
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

  if (user?.role !== "superadmin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Shield className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
            <p className="text-foreground/40 font-body">无权访问总后台（仅超级管理员可用）</p>
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
  const { user } = useAuth();
  const isMasterAdmin = user?.username === "xiaoqiadmin";
  const [tab, setTab] = useState<"stats" | "groups" | "users" | "messages" | "config" | "ai" | "devices">("stats");

  const allTabs = [
    { key: "stats" as const, label: "系统概览", icon: BarChart3 },
    { key: "groups" as const, label: "用户组管理", icon: Building2 },
    { key: "devices" as const, label: "设备管理", icon: Smartphone },
    { key: "users" as const, label: "全部用户", icon: Users },
    { key: "messages" as const, label: "全部记录", icon: MessageSquare },
    { key: "ai" as const, label: "AI配置", icon: Bot },
    { key: "config" as const, label: "系统配置", icon: Settings },
  ];
  const tabs = isMasterAdmin ? allTabs : allTabs.filter(t => t.key !== "groups" && t.key !== "devices");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-5 h-5 text-foreground/60" />
          <h1 className="text-lg font-serif text-foreground tracking-wider">总后台</h1>
          <span className="text-[10px] px-2 py-0.5 bg-foreground/10 text-foreground/50 font-body rounded">超级管理员</span>
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
        {tab === "stats" && <StatsPanel />}
        {tab === "groups" && <GroupsPanel />}
        {tab === "devices" && <DeviceManagementPanel />}
        {tab === "users" && <AllUsersPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "ai" && <AiConfigPanel />}
        {tab === "config" && <ConfigPanel />}
      </div>
    </div>
  );
}

function AiConfigPanel() {
  const { data: config, isLoading, refetch } = trpc.ai.getConfig.useQuery();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [bannedWords, setBannedWords] = useState("");
  const [bannedReplacements, setBannedReplacements] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");
  const [learningEnabled, setLearningEnabled] = useState(false);

  const updateMutation = trpc.ai.updateConfig.useMutation({
    onSuccess: () => { toast.success("AI配置已保存"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const testMutation = trpc.ai.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setTestStatus("success");
        toast.success("AI接口连接成功");
      } else {
        setTestStatus("error");
        setTestError(result.error || "连接失败");
        toast.error(result.error || "连接失败");
      }
    },
    onError: (err: any) => {
      setTestStatus("error");
      setTestError(err.message);
      toast.error(err.message);
    },
  });

  // Simulation state
  const [simMessage, setSimMessage] = useState("");
  const [simHistory, setSimHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(30);

  const { data: learningStats, isLoading: statsLoading, refetch: refetchStats } = trpc.ai.learningStats.useQuery(undefined, {
    refetchInterval: learningEnabled ? 15000 : false,
  });
  const { data: previewSamples } = trpc.ai.previewSamples.useQuery(
    { limit: 5 },
    { enabled: learningEnabled, refetchInterval: learningEnabled ? 30000 : false }
  );
  const { data: summaryData, refetch: refetchSummary } = trpc.ai.getSummary.useQuery(undefined, {
    enabled: learningEnabled,
    refetchInterval: learningEnabled ? 60000 : false, // Auto-refresh every 60s to show latest summary
  });

  // Sync delay settings from server
  useEffect(() => {
    if (summaryData) {
      setDelayMin(summaryData.replyDelayMin);
      setDelayMax(summaryData.replyDelayMax);
    }
  }, [summaryData]);

  const learnAndMarkMutation = trpc.ai.learnAndMark.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || `学习了${result.learnedCount}组对话`);
        refetchStats();
        refetchSummary();
      } else {
        toast.error(result.error || "学习失败");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateSummaryMutation = trpc.ai.generateSummary.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("学习总结已更新");
        refetchSummary();
      } else {
        toast.error(result.error || "生成总结失败");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateDelayMutation = trpc.ai.updateDelaySettings.useMutation({
    onSuccess: () => toast.success("延迟设置已保存"),
    onError: (err: any) => toast.error(err.message),
  });

  const simulateMutation = trpc.ai.simulate.useMutation({
    onSuccess: (result) => {
      if (result.success && result.reply) {
        setSimHistory(prev => [...prev, { role: "assistant", content: result.reply! }]);
      } else {
        toast.error(result.error || "模拟失败");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (config) {
      setApiUrl(config.apiUrl || "");
      setApiKey(config.apiKey || "");
      setModelName(config.modelName || "");
      setIsEnabled(config.isEnabled || false);
      setBannedWords(config.bannedWords || "");
      setBannedReplacements(config.bannedWordReplacements || "");
      setLearningEnabled(config.learningEnabled || false);
    }
  }, [config]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Global Switch */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-foreground/60" />
            <h3 className="text-sm font-serif text-foreground tracking-wider">AI 自动回复</h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400/80 rounded font-body">Beta</span>
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isEnabled ? "bg-green-500/80" : "bg-foreground/20"
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              isEnabled ? "left-[22px]" : "left-0.5"
            }`} />
          </button>
        </div>
        <p className="text-xs font-body text-muted-foreground/50">
          开启后，信使可在各自账号中启用 AI 自动回复功能。AI 将根据预设策略自动回复客户短信。
        </p>
      </div>

      {/* API Configuration */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-serif text-foreground tracking-wider">API 接口配置</h3>
          <span className="text-[10px] font-body text-muted-foreground/40">OpenAI 兼容格式</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">API 地址</label>
            <Input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="例如：https://api.openai.com/v1 或 https://api.deepseek.com/v1"
              className="h-9 bg-background/60 border-foreground/10 text-sm font-body"
            />
          </div>
          <div>
            <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">API Key</label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-9 bg-background/60 border-foreground/10 text-sm font-body pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">模型名称</label>
            <Input
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              placeholder="例如：gpt-4o-mini 或 deepseek-chat"
              className="h-9 bg-background/60 border-foreground/10 text-sm font-body"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                setTestStatus("testing");
                testMutation.mutate({ apiUrl, apiKey, modelName });
              }}
              disabled={!apiUrl || !apiKey || !modelName || testMutation.isPending}
              className="h-9 px-4 bg-blue-500/20 border border-blue-500/30 text-blue-400/80 hover:bg-blue-500/30 text-xs font-body"
            >
              {testMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
              测试连接
            </Button>
            {testStatus === "success" && (
              <span className="flex items-center gap-1 text-xs text-green-400/80 font-body">
                <CheckCircle2 className="w-3.5 h-3.5" /> 连接成功
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-red-400/80 font-body">
                <XCircle className="w-3.5 h-3.5" /> {testError}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banned Words */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-serif text-foreground tracking-wider">SMS 违禁词过滤</h3>
        </div>
        <p className="text-xs font-body text-muted-foreground/50 mb-4">
          AI 生成的回复将自动检测并替换违禁词，防止短信被屏蔽。每行一个违禁词。
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">违禁词列表（每行一个）</label>
            <textarea
              value={bannedWords}
              onChange={e => setBannedWords(e.target.value)}
              placeholder="例如：\n赌博\n贷款\n刷单"
              rows={4}
              className="w-full px-3 py-2 bg-background/60 border border-foreground/10 text-sm font-body text-foreground rounded resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">替换规则（格式：违禁词=替换词，每行一条）</label>
            <textarea
              value={bannedReplacements}
              onChange={e => setBannedReplacements(e.target.value)}
              placeholder="例如：\n微信=V信\n支付宝=ZFB\n银行卡=YHK"
              rows={4}
              className="w-full px-3 py-2 bg-background/60 border border-foreground/10 text-sm font-body text-foreground rounded resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>
        </div>
      </div>

      {/* AI Learning */}
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-foreground/60" />
            <h3 className="text-sm font-serif text-foreground tracking-wider">AI 学习</h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400/80 rounded font-body">Smart</span>
          </div>
          <button
            onClick={() => setLearningEnabled(!learningEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              learningEnabled ? "bg-purple-500/80" : "bg-foreground/20"
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              learningEnabled ? "left-[22px]" : "left-0.5"
            }`} />
          </button>
        </div>
        <p className="text-xs font-body text-muted-foreground/50 mb-4">
          开启后，AI 将自动监测并学习数据库中中国号码（+86）的真实人工对话记录，海外号码测试数据将自动过滤。每30秒自动刷新监测。
        </p>

        {learningEnabled && (
          <div className="space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-body text-green-400/80">
                AI学习已开启 · 每5分钟自动分析新对话并标记学习 · 收到新消息后60秒内自动触发学习 · 回复时智能判断是否应答 · 模拟真人打字速度
              </span>
            </div>

            {/* Learning Stats - 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-background/40 border border-foreground/5 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <Database className="w-3 h-3 text-purple-400/60" />
                  <span className="text-[10px] font-body text-muted-foreground/50">中国号码消息</span>
                </div>
                <p className="text-lg font-serif text-foreground">
                  {statsLoading ? "-" : (learningStats?.totalMessages ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-background/40 border border-foreground/5 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageCircle className="w-3 h-3 text-blue-400/60" />
                  <span className="text-[10px] font-body text-muted-foreground/50">有效对话组</span>
                </div>
                <p className="text-lg font-serif text-foreground">
                  {statsLoading ? "-" : (learningStats?.totalConversations ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-background/40 border border-foreground/5 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3 h-3 text-green-400/60" />
                  <span className="text-[10px] font-body text-muted-foreground/50">已发送</span>
                </div>
                <p className="text-lg font-serif text-foreground">
                  {statsLoading ? "-" : (learningStats?.totalOutgoing ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-background/40 border border-foreground/5 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3 h-3 text-amber-400/60" />
                  <span className="text-[10px] font-body text-muted-foreground/50">已收到</span>
                </div>
                <p className="text-lg font-serif text-foreground">
                  {statsLoading ? "-" : (learningStats?.totalIncoming ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-background/40 border border-green-500/20 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400/60" />
                  <span className="text-[10px] font-body text-green-400/60">已学习</span>
                </div>
                <p className="text-lg font-serif text-green-400">
                  {statsLoading ? "-" : (learningStats?.learnedMessages ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-background/40 border border-orange-500/20 p-3 rounded">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-orange-400/60" />
                  <span className="text-[10px] font-body text-orange-400/60">未学习</span>
                </div>
                <p className="text-lg font-serif text-orange-400">
                  {statsLoading ? "-" : (learningStats?.unlearnedMessages ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => learnAndMarkMutation.mutate({})}
                disabled={learnAndMarkMutation.isPending}
                className="h-8 px-4 border text-xs font-body bg-green-500/20 border-green-500/30 text-green-400/80 hover:bg-green-500/30"
              >
                {learnAndMarkMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <GraduationCap className="w-3 h-3 mr-1" />}
                学习并标记
              </Button>
              <Button
                size="sm"
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                className="h-8 px-4 border text-xs font-body bg-blue-500/20 border-blue-500/30 text-blue-400/80 hover:bg-blue-500/30"
              >
                {generateSummaryMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
                生成总结
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSummary(!showSummary)}
                className={`h-8 px-4 border text-xs font-body ${
                  showSummary
                    ? "bg-purple-500/30 border-purple-500/40 text-purple-400/90"
                    : "bg-purple-500/20 border-purple-500/30 text-purple-400/80 hover:bg-purple-500/30"
                }`}
              >
                <Brain className="w-3 h-3 mr-1" />
                学习总结
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSimulator(!showSimulator)}
                className={`h-8 px-4 border text-xs font-body ${
                  showSimulator
                    ? "bg-amber-500/30 border-amber-500/40 text-amber-400/90"
                    : "bg-amber-500/20 border-amber-500/30 text-amber-400/80 hover:bg-amber-500/30"
                }`}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                对话模拟
              </Button>
            </div>

            {/* Learning Summary Window */}
            {showSummary && (
              <div className="bg-background/30 border border-purple-500/20 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-purple-400/70" />
                    <span className="text-xs font-serif text-foreground/80">学习总结报告</span>
                    {summaryData?.lastSummaryAt && (
                      <span className="text-[10px] font-body text-muted-foreground/40">
                        上次更新: {new Date(summaryData.lastSummaryAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => refetchSummary()}
                    className="text-[10px] font-body text-muted-foreground/40 hover:text-foreground/60"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                {summaryData?.summary ? (
                  <div className="bg-background/40 border border-foreground/5 rounded p-3">
                    <pre className="text-xs font-body text-foreground/70 whitespace-pre-wrap leading-relaxed">{summaryData.summary}</pre>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs font-body text-muted-foreground/40">还没有学习总结，系统每5分钟自动学习一次，也可点击上方"学习并标记"手动触发</p>
                  </div>
                )}
              </div>
            )}

            {/* Reply Delay Settings */}
            <div className="bg-background/30 border border-foreground/5 rounded p-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-3.5 h-3.5 text-foreground/50" />
                <span className="text-xs font-serif text-foreground/80">回复延迟设置</span>
                <span className="text-[10px] font-body text-muted-foreground/40">模拟真人打字速度，避免秒回</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-body text-muted-foreground/50">最小延迟</span>
                  <Input
                    type="number"
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value))}
                    className="w-16 h-7 text-xs bg-background/40 border-foreground/10 text-center"
                    min={1}
                    max={120}
                  />
                  <span className="text-[10px] font-body text-muted-foreground/40">秒</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-body text-muted-foreground/50">最大延迟</span>
                  <Input
                    type="number"
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number(e.target.value))}
                    className="w-16 h-7 text-xs bg-background/40 border-foreground/10 text-center"
                    min={1}
                    max={300}
                  />
                  <span className="text-[10px] font-body text-muted-foreground/40">秒</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateDelayMutation.mutate({ replyDelayMin: delayMin, replyDelayMax: delayMax })}
                  disabled={updateDelayMutation.isPending}
                  className="h-7 px-3 text-[10px] font-body bg-foreground/10 border border-foreground/15 text-foreground/60 hover:bg-foreground/20"
                >
                  {updateDelayMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "保存"}
                </Button>
              </div>
              <p className="text-[10px] font-body text-muted-foreground/30 mt-2">
                AI回复时会根据回复字数计算延迟（每字约0.3-0.5秒），在最小和最大延迟之间随机波动，模拟真人打字节奏
              </p>
            </div>

            {/* Conversation Simulator */}
            {showSimulator && (
              <div className="bg-background/30 border border-amber-500/20 rounded p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400/70" />
                  <span className="text-xs font-serif text-foreground/80">对话模拟器</span>
                  <span className="text-[10px] font-body text-muted-foreground/40">测试AI回复质量，模拟客户发送消息</span>
                  {simHistory.length > 0 && (
                    <button
                      onClick={() => setSimHistory([])}
                      className="ml-auto text-[10px] font-body text-muted-foreground/40 hover:text-foreground/60"
                    >
                      清空对话
                    </button>
                  )}
                </div>

                {/* Chat History */}
                {simHistory.length > 0 && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto px-1">
                    {simHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${
                        msg.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs font-body ${
                          msg.role === 'user'
                            ? 'bg-foreground/5 text-foreground/70'
                            : 'bg-purple-500/15 text-purple-300/90'
                        }`}>
                          <div className="text-[9px] mb-1 opacity-50">
                            {msg.role === 'user' ? '模拟客户' : 'AI 回复'}
                          </div>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {simulateMutation.isPending && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-3 py-2 rounded-lg text-xs font-body bg-purple-500/15 text-purple-300/90">
                          <div className="text-[9px] mb-1 opacity-50">AI 回复</div>
                          <div className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>思考中...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={simMessage}
                    onChange={(e) => setSimMessage(e.target.value)}
                    placeholder="输入模拟客户消息...例如：你好，看到你的短信了"
                    className="flex-1 h-8 text-xs bg-background/40 border-foreground/10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && simMessage.trim() && !simulateMutation.isPending) {
                        const msg = simMessage.trim();
                        setSimHistory(prev => [...prev, { role: 'user', content: msg }]);
                        simulateMutation.mutate({
                          message: msg,
                          history: [...simHistory, { role: 'user', content: msg }],
                        });
                        setSimMessage("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (simMessage.trim()) {
                        const msg = simMessage.trim();
                        setSimHistory(prev => [...prev, { role: 'user', content: msg }]);
                        simulateMutation.mutate({
                          message: msg,
                          history: [...simHistory, { role: 'user', content: msg }],
                        });
                        setSimMessage("");
                      }
                    }}
                    disabled={!simMessage.trim() || simulateMutation.isPending}
                    className="h-8 px-3 bg-amber-500/20 border border-amber-500/30 text-amber-400/80 hover:bg-amber-500/30"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Recent Samples Preview */}
            {previewSamples && previewSamples.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare className="w-3 h-3 text-foreground/40" />
                  <span className="text-xs font-body text-muted-foreground/50">中国号码对话样本预览（AI回复时实时参考）</span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {previewSamples.slice(0, 5).map((sample: any, idx: number) => (
                    <div key={idx} className="bg-background/30 border border-foreground/5 p-3 rounded text-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-body text-muted-foreground/40">
                          对话 #{idx + 1} · {sample.phoneNumber} · {sample.messages?.length || 0} 条消息
                        </span>
                      </div>
                      <div className="space-y-1">
                        {(sample.messages || []).slice(-6).map((msg: any, mIdx: number) => (
                          <div key={mIdx} className={`flex gap-2 ${
                            msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                          }`}>
                            <span className={`inline-block max-w-[80%] px-2 py-1 rounded text-[11px] font-body ${
                              msg.direction === 'outgoing'
                                ? 'bg-blue-500/10 text-blue-300/80'
                                : 'bg-foreground/5 text-foreground/60'
                            }`}>
                              {msg.direction === 'outgoing' ? '我方' : '客户'}: {msg.body?.slice(0, 80)}{msg.body?.length > 80 ? '...' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => {
            // Convert banned words text to JSON array
            const wordsArray = bannedWords.split("\n").map(w => w.trim()).filter(Boolean);
            // Convert replacements text to JSON object
            const replacementsObj: Record<string, string> = {};
            bannedReplacements.split("\n").forEach(line => {
              const [key, val] = line.split("=").map(s => s.trim());
              if (key && val) replacementsObj[key] = val;
            });
            updateMutation.mutate({
              apiUrl: apiUrl.trim(),
              apiKey: apiKey.trim(),
              modelName: modelName.trim(),
              isEnabled,
              bannedWords: JSON.stringify(wordsArray),
              bannedWordReplacements: JSON.stringify(replacementsObj),
              learningEnabled,
            });
          }}
          disabled={!apiUrl || !apiKey || !modelName || updateMutation.isPending}
          className="h-9 px-6 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
        >
          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          保存配置
        </Button>
      </div>
    </div>
  );
}

function StatsPanel() {
  const { user } = useAuth();
  const isMasterAdmin = user?.username === "xiaoqiadmin";
  const { data: stats, isLoading } = trpc.superadmin.stats.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  const allItems = [
    { label: "用户组", value: stats?.totalGroups ?? 0, icon: Building2 },
    { label: "注册用户", value: stats?.totalUsers ?? 0, icon: Users },
    { label: "设备总数", value: stats?.totalDevices ?? 0, icon: Smartphone },
    { label: "在线设备", value: stats?.onlineDevices ?? 0, icon: Wifi },
    { label: "短信总量", value: stats?.totalMessages ?? 0, icon: MessageSquare },
  ];
  const items = isMasterAdmin ? allItems : allItems.filter(i => i.label !== "用户组");

  return (
    <div className="p-6">
      <div className={`grid grid-cols-2 ${items.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
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

function GroupsPanel() {
  const { data: groupList, isLoading, refetch } = trpc.superadmin.groups.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMax, setNewMax] = useState("10");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const createMutation = trpc.superadmin.createGroup.useMutation({
    onSuccess: () => {
      toast.success("用户组创建成功");
      refetch();
      setShowCreate(false);
      setNewName("");
      setNewCode("");
      setNewMax("10");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newName.trim() || !newCode.trim()) {
      toast.error("请填写完整信息");
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      groupCode: newCode.trim(),
      maxDevices: parseInt(newMax) || 10,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Create new group */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="h-8 px-4 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
        >
          <Plus className="w-3 h-3 mr-1" />
          新建用户组
        </Button>
      </div>

      {showCreate && (
        <div className="relative bg-card/50 border border-foreground/10 p-5 space-y-3">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />

          <h3 className="text-sm font-serif text-foreground tracking-wider mb-3">创建用户组（子后台）</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-body text-muted-foreground/60 mb-1">组名称</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例如：华东区" className="h-9 bg-background/60 border-foreground/10 text-sm font-body" />
            </div>
            <div>
              <label className="block text-xs font-body text-muted-foreground/60 mb-1">唯一标识码</label>
              <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="例如：huadong01" className="h-9 bg-background/60 border-foreground/10 text-sm font-body" />
            </div>
            <div>
              <label className="block text-xs font-body text-muted-foreground/60 mb-1">设备总配额</label>
              <Input value={newMax} onChange={e => setNewMax(e.target.value)} type="number" min={1} className="h-9 bg-background/60 border-foreground/10 text-sm font-body" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending} className="h-8 px-4 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              创建
            </Button>
            <Button size="sm" onClick={() => setShowCreate(false)} className="h-8 px-4 text-xs font-body text-muted-foreground/50 hover:text-foreground">
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="space-y-2">
        {groupList?.map(g => (
          <GroupRow key={g.id} group={g} isExpanded={expandedId === g.id} onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)} onRefresh={refetch} />
        ))}
        {(!groupList || groupList.length === 0) && (
          <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">暂无用户组，点击上方按钮创建</div>
        )}
      </div>
    </div>
  );
}

function GroupRow({ group, isExpanded, onToggle, onRefresh }: { group: any; isExpanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const [maxDevices, setMaxDevices] = useState(String(group.maxDevices));
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  const updateMutation = trpc.superadmin.updateGroup.useMutation({
    onSuccess: () => { toast.success("更新成功"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const createAdminMutation = trpc.superadmin.createGroupAdmin.useMutation({
    onSuccess: () => {
      toast.success("子后台管理员创建成功");
      setShowAdminForm(false);
      setAdminUsername("");
      setAdminPassword("");
      setAdminName("");
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.groupCode);
    toast.success("标识码已复制");
  };

  return (
    <div className="bg-card/40 border border-foreground/8 overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-foreground/5 transition-colors text-left">
        <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-foreground/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body text-foreground truncate">{group.name}</span>
            {!group.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400/80 font-body rounded">已禁用</span>}
          </div>
          <div className="text-xs text-muted-foreground/40 font-body">
            标识码: {group.groupCode} · 人员 {group.userCount}人 · 设备 {group.deviceCount}/{group.maxDevices}台 · 已分配 {group.allocatedDevices}台
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-foreground/5 pt-3 space-y-3">
          {/* Copy group code */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">标识码</label>
            <code className="text-sm font-mono text-foreground/70 bg-background/60 px-2 py-1 border border-foreground/10">{group.groupCode}</code>
            <Button size="sm" onClick={handleCopyCode} className="h-7 px-2 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              <Copy className="w-3 h-3 mr-1" />复制
            </Button>
          </div>

          {/* Update quota */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-body text-muted-foreground/60 w-20 shrink-0">设备配额</label>
            <Input value={maxDevices} onChange={e => setMaxDevices(e.target.value)} className="h-8 w-24 text-sm bg-background/60 border-foreground/10 font-body text-center" type="number" min={0} />
            <span className="text-xs text-muted-foreground/40 font-body">台</span>
            <Button size="sm" onClick={() => updateMutation.mutate({ id: group.id, maxDevices: parseInt(maxDevices) || 0 })} disabled={updateMutation.isPending} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              <Save className="w-3 h-3 mr-1" />保存
            </Button>
          </div>

          {/* Toggle active */}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate({ id: group.id, isActive: !group.isActive })} disabled={updateMutation.isPending}
              className={`h-8 px-3 text-xs font-body border ${group.isActive ? "bg-red-500/10 border-red-500/20 text-red-400/80 hover:bg-red-500/20" : "bg-green-500/10 border-green-500/20 text-green-400/80 hover:bg-green-500/20"}`}>
              {group.isActive ? <><ShieldOff className="w-3 h-3 mr-1" />禁用</> : <><Shield className="w-3 h-3 mr-1" />启用</>}
            </Button>
            <Button size="sm" onClick={() => setShowAdminForm(!showAdminForm)} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
              <Crown className="w-3 h-3 mr-1" />创建管理员
            </Button>
          </div>

          {/* Create admin form */}
          {showAdminForm && (
            <div className="bg-background/40 border border-foreground/5 p-3 space-y-2 mt-2">
              <h4 className="text-xs font-serif text-foreground/70 tracking-wider">创建子后台管理员</h4>
              <div className="grid grid-cols-3 gap-2">
                <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="昵称" className="h-8 text-sm bg-background/60 border-foreground/10 font-body" />
                <Input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="用户名" className="h-8 text-sm bg-background/60 border-foreground/10 font-body" />
                <Input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="密码（至少6位）" type="password" className="h-8 text-sm bg-background/60 border-foreground/10 font-body" />
              </div>
              <Button size="sm" onClick={() => createAdminMutation.mutate({ groupId: group.id, username: adminUsername.trim(), password: adminPassword, name: adminName.trim() })} disabled={createAdminMutation.isPending} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
                {createAdminMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                创建管理员
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AllUsersPanel() {
  const { data: userList, isLoading, refetch } = trpc.superadmin.allUsers.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    if (!userList) return [];
    if (!searchTerm) return userList;
    const s = searchTerm.toLowerCase();
    return userList.filter((u: any) =>
      u.username?.toLowerCase().includes(s) ||
      u.name?.toLowerCase().includes(s) ||
      u.groupName?.toLowerCase().includes(s)
    );
  }, [userList, searchTerm]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜索用户名、昵称、用户组..." className="pl-9 h-9 bg-background/60 border-foreground/10 text-sm font-body" />
      </div>
      <div className="space-y-2">
        {filteredUsers.map((u: any) => (
          <SuperadminUserRow key={u.id} user={u} isExpanded={expandedId === u.id} onToggle={() => setExpandedId(expandedId === u.id ? null : u.id)} onRefresh={refetch} />
        ))}
        {filteredUsers.length === 0 && <div className="text-center py-10 text-muted-foreground/40 font-body text-sm">暂无用户数据</div>}
      </div>
    </div>
  );
}

function SuperadminUserRow({ user, isExpanded, onToggle, onRefresh }: { user: any; isExpanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const [maxDevices, setMaxDevices] = useState(String(user.maxDevices ?? 1));
  const [newPassword, setNewPassword] = useState("");

  const updateMutation = trpc.superadmin.updateUser.useMutation({
    onSuccess: () => { toast.success("更新成功"); onRefresh(); },
    onError: (err) => toast.error(err.message),
  });

  const resetPwdMutation = trpc.superadmin.resetPassword.useMutation({
    onSuccess: () => { toast.success("密码已重置"); setNewPassword(""); },
    onError: (err) => toast.error(err.message),
  });

  const roleLabel = user.role === "superadmin" ? "超管" : user.role === "admin" ? "主管" : "一线";
  const roleColor = user.role === "superadmin" ? "bg-yellow-500/20 text-yellow-400/80" : user.role === "admin" ? "bg-blue-500/20 text-blue-400/80" : "bg-foreground/10 text-foreground/50";

  return (
    <div className="bg-card/40 border border-foreground/8 overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-foreground/5 transition-colors text-left">
        <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-serif text-foreground/60">{(user.name || user.username || "?")[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-body text-foreground truncate">{user.name || user.username}</span>
            <span className={`text-[10px] px-1.5 py-0.5 font-body rounded ${roleColor}`}>{roleLabel}</span>
            {!user.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400/80 font-body rounded">已禁用</span>}
          </div>
          <div className="text-xs text-muted-foreground/40 font-body">
            @{user.username} · {user.groupName ? `组: ${user.groupName}` : "无组"} · 设备 {user.deviceCount}/{user.maxDevices}台
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
          <div className="text-xs text-muted-foreground/30 font-body pt-1 space-y-0.5">
            <div>最后登录：{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("zh-CN") : "从未"}</div>
            <div>注册时间：{new Date(user.createdAt).toLocaleString("zh-CN")}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesPanel() {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { data: groupList } = trpc.superadmin.groups.useQuery();
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>();

  const startTime = startDate ? new Date(startDate).getTime() : undefined;
  const endTime = endDate ? new Date(endDate + "T23:59:59").getTime() : undefined;

  const { data: msgs, isLoading } = trpc.superadmin.messages.useQuery({
    groupId: selectedGroup,
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
        <select value={selectedGroup || ""} onChange={e => setSelectedGroup(e.target.value ? Number(e.target.value) : undefined)}
          className="h-9 px-3 bg-background/60 border border-foreground/10 text-sm font-body text-foreground rounded">
          <option value="">全部用户组</option>
          {groupList?.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
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

function ConfigPanel() {
  const { data: configs, isLoading, refetch } = trpc.superadmin.getConfigs.useQuery();
  const [serviceLink, setServiceLink] = useState("");

  const setConfigMutation = trpc.superadmin.setConfig.useMutation({
    onSuccess: () => { toast.success("配置已保存"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (configs) {
      const csLink = configs.find((c: any) => c.configKey === "customer_service_link");
      if (csLink?.configValue) setServiceLink(csLink.configValue);
    }
  }, [configs]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="relative bg-card/50 border border-foreground/10 p-6">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-foreground/60" />
          <h3 className="text-sm font-serif text-foreground tracking-wider">客服联系链接</h3>
        </div>
        <p className="text-xs font-body text-muted-foreground/50 mb-4">用户设备超限时将显示此链接，引导用户联系客服购买更多设备配额。</p>
        <div className="flex items-center gap-3">
          <Input value={serviceLink} onChange={e => setServiceLink(e.target.value)} placeholder="例如：https://work.weixin.qq.com/kfid/xxx" className="h-9 flex-1 bg-background/60 border-foreground/10 text-sm font-body" />
          <Button size="sm" onClick={() => setConfigMutation.mutate({ key: "customer_service_link", value: serviceLink.trim(), description: "客服联系链接" })} disabled={setConfigMutation.isPending} className="h-9 px-4 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
            {setConfigMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            保存
          </Button>
        </div>
      </div>

      {configs && configs.length > 0 && (
        <div className="relative bg-card/50 border border-foreground/10 p-6">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-foreground/60" />
            <h3 className="text-sm font-serif text-foreground tracking-wider">配置项列表</h3>
          </div>
          <div className="space-y-2">
            {configs.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-background/40 border border-foreground/5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-body text-foreground/70">{c.configKey}</div>
                  <div className="text-xs font-body text-muted-foreground/40 truncate mt-0.5">{c.description || "无描述"}</div>
                </div>
                <div className="text-xs font-body text-foreground/50 max-w-xs truncate ml-4">{c.configValue || "（空）"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Device Management Panel (xiaoqiadmin only) ───
function DeviceManagementPanel() {
  const { data: allDevices, isLoading, refetch } = trpc.superadmin.onlineDevices.useQuery(undefined, {
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
  const [kickingUser, setKickingUser] = useState<number | null>(null);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const kickMutation = trpc.superadmin.kickUser.useMutation({
    onSuccess: (data) => {
      toast.success(`已踢出：${data.dashKicked}个网页会话，${data.deviceKicked}台设备`);
      refetch();
      setKickingUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const kickAndResetMutation = trpc.superadmin.kickAndResetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(`已踢出并重置密码：${data.dashKicked}个网页会话，${data.deviceKicked}台设备`);
      refetch();
      setResetUserId(null);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  const devices = allDevices || [];
  const filteredDevices = filter === "all" ? devices : devices.filter(d => filter === "online" ? d.isOnline : !d.isOnline);

  // Group devices by groupName
  const grouped = new Map<string, typeof filteredDevices>();
  for (const d of filteredDevices) {
    const key = d.groupName || "未分组";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  }

  const onlineCount = devices.filter(d => d.isOnline).length;
  const offlineCount = devices.filter(d => !d.isOnline).length;

  // Collect unique users for kick operations (non-superadmin)
  const userMap = new Map<number, { userId: number; username: string | null; name: string | null; role: string; groupName: string | null; deviceCount: number; onlineDevices: number }>();
  for (const d of devices) {
    const existing = userMap.get(d.userId);
    if (existing) {
      existing.deviceCount++;
      if (d.isOnline) existing.onlineDevices++;
    } else {
      userMap.set(d.userId, {
        userId: d.userId,
        username: d.ownerUsername,
        name: d.ownerName,
        role: d.ownerRole,
        groupName: d.groupName,
        deviceCount: 1,
        onlineDevices: d.isOnline ? 1 : 0,
      });
    }
  }
  const userList = Array.from(userMap.values()).filter(u => u.role !== "superadmin");

  return (
    <div className="p-6 space-y-6">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-foreground/60" />
            <span className="text-sm font-body text-foreground/70">总设备: <strong className="text-foreground">{devices.length}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-400/70" />
            <span className="text-sm font-body text-green-400/70">在线: <strong>{onlineCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-red-400/70" />
            <span className="text-sm font-body text-red-400/70">离线: <strong>{offlineCount}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter("all")} className={`px-3 py-1 text-xs font-body rounded transition-colors ${filter === "all" ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>全部</button>
          <button onClick={() => setFilter("online")} className={`px-3 py-1 text-xs font-body rounded transition-colors ${filter === "online" ? "bg-green-500/20 text-green-400" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>在线</button>
          <button onClick={() => setFilter("offline")} className={`px-3 py-1 text-xs font-body rounded transition-colors ${filter === "offline" ? "bg-red-500/20 text-red-400" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>离线</button>
          <button onClick={() => refetch()} className="ml-2 p-1.5 text-foreground/40 hover:text-foreground/70 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Grouped device list */}
      {Array.from(grouped.entries()).map(([groupName, groupDevices]) => (
        <div key={groupName} className="border border-foreground/10 bg-card/30">
          <div className="px-4 py-3 border-b border-foreground/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-foreground/50" />
              <span className="text-sm font-serif text-foreground tracking-wider">{groupName}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-foreground/10 text-foreground/50 rounded">{groupDevices.length}台</span>
            </div>
            <span className="text-[10px] text-green-400/60">{groupDevices.filter(d => d.isOnline).length}台在线</span>
          </div>
          <div className="divide-y divide-foreground/5">
            {groupDevices.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between hover:bg-foreground/5 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${d.isOnline ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : "bg-red-400/50"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-body text-foreground truncate">{d.name}</span>
                      {d.phoneModel && <span className="text-[10px] text-muted-foreground/40">{d.phoneModel}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/40">用户: {d.ownerName || d.ownerUsername || "未知"}</span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${d.ownerRole === "admin" ? "bg-blue-500/20 text-blue-400/80" : "bg-foreground/10 text-foreground/50"}`}>
                        {d.ownerRole === "admin" ? "主管" : "信使"}
                      </span>
                      {d.phoneNumber && <span className="text-[10px] text-muted-foreground/30">{d.phoneNumber}</span>}
                      {d.batteryLevel != null && <span className="text-[10px] text-muted-foreground/30">电量{d.batteryLevel}%</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.ownerRole !== "superadmin" && (
                    <>
                      <button
                        onClick={() => {
                          if (kickingUser === d.userId) {
                            kickMutation.mutate({ userId: d.userId });
                          } else {
                            setKickingUser(d.userId);
                            setResetUserId(null);
                            setTimeout(() => setKickingUser(null), 3000);
                          }
                        }}
                        disabled={kickMutation.isPending}
                        className={`px-2.5 py-1 text-[10px] font-body rounded transition-colors ${
                          kickingUser === d.userId
                            ? "bg-red-500/30 text-red-300 border border-red-500/50"
                            : "bg-foreground/5 text-foreground/50 hover:bg-red-500/20 hover:text-red-400 border border-foreground/10"
                        }`}
                      >
                        <LogOut className="w-3 h-3 inline mr-1" />
                        {kickingUser === d.userId ? "确认踢出" : "踢出"}
                      </button>
                      <button
                        onClick={() => {
                          if (resetUserId === d.userId && newPassword.length >= 6) {
                            kickAndResetMutation.mutate({ userId: d.userId, newPassword });
                          } else {
                            setResetUserId(d.userId);
                            setKickingUser(null);
                            setNewPassword("");
                          }
                        }}
                        disabled={kickAndResetMutation.isPending}
                        className={`px-2.5 py-1 text-[10px] font-body rounded transition-colors ${
                          resetUserId === d.userId
                            ? "bg-orange-500/30 text-orange-300 border border-orange-500/50"
                            : "bg-foreground/5 text-foreground/50 hover:bg-orange-500/20 hover:text-orange-400 border border-foreground/10"
                        }`}
                      >
                        <Power className="w-3 h-3 inline mr-1" />
                        {resetUserId === d.userId ? "确认" : "踢出+重置密码"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {/* Show password input when resetting */}
            {groupDevices.some(d => resetUserId === d.userId) && (
              <div className="px-4 py-3 bg-orange-500/5 border-t border-orange-500/20">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-4 h-4 text-orange-400/60" />
                  <span className="text-xs font-body text-orange-400/70">输入新密码:</span>
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="至少6位新密码"
                    className="h-7 text-xs w-48 bg-background/50 border-orange-500/30"
                  />
                  <button
                    onClick={() => {
                      if (resetUserId && newPassword.length >= 6) {
                        kickAndResetMutation.mutate({ userId: resetUserId, newPassword });
                      } else {
                        toast.error("密码至少6位");
                      }
                    }}
                    disabled={kickAndResetMutation.isPending || newPassword.length < 6}
                    className="px-3 py-1 text-[10px] font-body bg-orange-500/20 text-orange-300 rounded hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
                  >
                    {kickAndResetMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "确认踢出并重置"}
                  </button>
                  <button
                    onClick={() => { setResetUserId(null); setNewPassword(""); }}
                    className="px-2 py-1 text-[10px] font-body text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {filteredDevices.length === 0 && (
        <div className="text-center py-16">
          <Monitor className="w-8 h-8 text-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-body text-muted-foreground/40">
            {filter === "online" ? "暂无在线设备" : filter === "offline" ? "暂无离线设备" : "暂无设备"}
          </p>
        </div>
      )}
    </div>
  );
}
