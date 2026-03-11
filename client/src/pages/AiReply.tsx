import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Bot, Loader2, Save, User, MessageSquare, Target,
  CheckCircle2, AlertCircle, Clock, Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function AiReply() {
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
    window.location.href = getLoginUrl("/ai-reply");
    return null;
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <AiReplyContent userId={user!.id} />
      </div>
    </DashboardLayout>
  );
}

function AiReplyContent({ userId }: { userId: number }) {
  const { data: settings, isLoading, refetch } = trpc.ai.getSettings.useQuery();
  const { data: conversations, isLoading: convLoading } = trpc.ai.conversations.useQuery({ deviceId: undefined });
  const [isEnabled, setIsEnabled] = useState(false);
  const [personaName, setPersonaName] = useState("小美");
  const [targetApp, setTargetApp] = useState("微信");
  const [targetAppId, setTargetAppId] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "conversations">("settings");

  const updateMutation = trpc.ai.updateSettings.useMutation({
    onSuccess: () => { toast.success("AI设置已保存"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled || false);
      setPersonaName(settings.personaName || "小美");
      setTargetApp(settings.targetApp || "微信");
      setTargetAppId(settings.targetAppId || "");
      setCustomPrompt(settings.customPrompt || "");
    }
  }, [settings]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-5 h-5 text-foreground/60" />
          <h1 className="text-lg font-serif text-foreground tracking-wider">AI 自动回复</h1>
          <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400/80 font-body rounded">Beta</span>
        </div>
        <div className="flex gap-1">
          {[
            { key: "settings" as const, label: "回复设置", icon: Sparkles },
            { key: "conversations" as const, label: "对话记录", icon: MessageSquare },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 text-sm font-body tracking-wider rounded transition-colors ${
                activeTab === t.key
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
        {activeTab === "settings" && (
          <div className="p-6 space-y-6">
            {/* Enable Switch */}
            <div className="relative bg-card/50 border border-foreground/10 p-6">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-foreground/60" />
                  <h3 className="text-sm font-serif text-foreground tracking-wider">启用 AI 自动回复</h3>
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
                开启后，您所有设备收到的客户短信将由 AI 自动分析并回复。AI 会根据预设的相亲话术策略，在10轮对话内自然地了解客户信息并引导客户添加指定APP。
              </p>
            </div>

            {/* Persona Settings */}
            <div className="relative bg-card/50 border border-foreground/10 p-6">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-serif text-foreground tracking-wider">AI 人设配置</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">人设名字</label>
                  <Input
                    value={personaName}
                    onChange={e => setPersonaName(e.target.value)}
                    placeholder="AI扮演的名字，例如：小美、婷婷"
                    className="h-9 bg-background/60 border-foreground/10 text-sm font-body"
                  />
                  <p className="text-[10px] font-body text-muted-foreground/30 mt-1">AI 在聊天中使用的名字，客户问名字时会回答这个</p>
                </div>
                <div>
                  <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">年龄设定</label>
                  <p className="text-xs font-body text-muted-foreground/50 px-3 py-2 bg-background/40 border border-foreground/5 rounded">
                    自动设定：比客户大 5-7 岁（客户年龄未知时随机 28-35 岁）
                  </p>
                </div>
              </div>
            </div>

            {/* Target APP */}
            <div className="relative bg-card/50 border border-foreground/10 p-6">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-serif text-foreground tracking-wider">引导目标</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">目标 APP 名称</label>
                  <Input
                    value={targetApp}
                    onChange={e => setTargetApp(e.target.value)}
                    placeholder="例如：微信、WhatsApp、Telegram"
                    className="h-9 bg-background/60 border-foreground/10 text-sm font-body"
                  />
                </div>
                <div>
                  <label className="text-xs font-body text-muted-foreground/60 mb-1.5 block">您的 APP 账号/ID</label>
                  <Input
                    value={targetAppId}
                    onChange={e => setTargetAppId(e.target.value)}
                    placeholder="例如：wxid_abc123 或 +8613800138000"
                    className="h-9 bg-background/60 border-foreground/10 text-sm font-body"
                  />
                  <p className="text-[10px] font-body text-muted-foreground/30 mt-1">AI 在引导客户时会告知这个账号</p>
                </div>
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="relative bg-card/50 border border-foreground/10 p-6">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-serif text-foreground tracking-wider">自定义补充提示（可选）</h3>
              </div>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="在此添加额外的AI行为指令，例如：&#10;- 聊天时多提到自己喜欢旅游&#10;- 如果客户说在XX城市，表示自己也在附近&#10;- 不要主动提到收入话题"
                rows={5}
                className="w-full px-3 py-2 bg-background/60 border border-foreground/10 text-sm font-body text-foreground rounded resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            {/* Strategy Info */}
            <div className="relative bg-card/50 border border-foreground/10 p-6">
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-foreground/15" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-foreground/15" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-foreground/15" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-foreground/15" />
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-foreground/60" />
                <h3 className="text-sm font-serif text-foreground tracking-wider">对话策略说明</h3>
              </div>
              <div className="space-y-3">
                {[
                  { round: "第 1-2 轮", desc: "热情打招呼，建立初步好感，聊轻松话题", color: "text-blue-400/70" },
                  { round: "第 3-4 轮", desc: "自然聊到工作生活，委婉了解年龄和职业", color: "text-cyan-400/70" },
                  { round: "第 5-6 轮", desc: "通过分享引导对方，了解收入和婚姻状况", color: "text-green-400/70" },
                  { round: "第 7-8 轮", desc: "加深情感连接，铺垫转移到其他平台聊天", color: "text-amber-400/70" },
                  { round: "第 9-10 轮", desc: "自然引导客户添加目标APP，完成转化", color: "text-red-400/70" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2 bg-background/40 border border-foreground/5 rounded">
                    <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5 font-body font-medium ${s.color} bg-foreground/5`}>
                      {s.round}
                    </span>
                    <span className="text-xs font-body text-foreground/60">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  updateMutation.mutate({
                    isEnabled,
                    personaName: personaName.trim() || "小美",
                    targetApp: targetApp.trim() || "微信",
                    targetAppId: targetAppId.trim() || undefined,
                    customPrompt: customPrompt.trim() || undefined,
                  });
                }}
                disabled={updateMutation.isPending}
                className="h-9 px-6 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body"
              >
                {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                保存设置
              </Button>
            </div>
          </div>
        )}

        {activeTab === "conversations" && (
          <div className="p-6">
            {convLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>
            ) : (
              <div className="space-y-2">
                {conversations && conversations.length > 0 ? conversations.map((conv: any) => (
                  <div key={conv.id} className="relative bg-card/50 border border-foreground/10 p-4">
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-foreground/15" />
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-foreground/15" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-foreground/15" />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-foreground/15" />
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-foreground/40" />
                        <span className="text-sm font-body text-foreground/80">{conv.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-body ${
                          conv.isActive ? "bg-green-500/20 text-green-400/80" : "bg-foreground/10 text-foreground/40"
                        }`}>
                          {conv.isActive ? `进行中 (${conv.currentRound}/10)` : "已完成"}
                        </span>
                        {conv.hasGuidedToApp && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400/80 rounded font-body">
                            已引导
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {conv.customerAge && (
                        <span className="text-[10px] px-2 py-0.5 bg-background/60 border border-foreground/5 rounded font-body text-foreground/50">
                          年龄: {conv.customerAge}岁
                        </span>
                      )}
                      {conv.customerJob && (
                        <span className="text-[10px] px-2 py-0.5 bg-background/60 border border-foreground/5 rounded font-body text-foreground/50">
                          职业: {conv.customerJob}
                        </span>
                      )}
                      {conv.customerIncome && (
                        <span className="text-[10px] px-2 py-0.5 bg-background/60 border border-foreground/5 rounded font-body text-foreground/50">
                          收入: {conv.customerIncome}
                        </span>
                      )}
                      {conv.customerMaritalStatus && (
                        <span className="text-[10px] px-2 py-0.5 bg-background/60 border border-foreground/5 rounded font-body text-foreground/50">
                          婚姻: {conv.customerMaritalStatus}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-body text-muted-foreground/30">
                      <Clock className="w-3 h-3" />
                      <span>更新于 {new Date(conv.updatedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-20">
                    <Bot className="w-10 h-10 text-foreground/10 mx-auto mb-3" />
                    <p className="text-sm font-body text-muted-foreground/40">暂无 AI 对话记录</p>
                    <p className="text-xs font-body text-muted-foreground/25 mt-1">开启 AI 自动回复后，收到客户短信时将自动开始对话</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
