import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useDashboardSocket } from "@/hooks/useSocket";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Play, Pause, Square, Plus, Upload, Trash2, Users, Zap,
  Shuffle, RotateCcw, Clock, CheckCircle2, XCircle, Loader2,
  Smartphone, FileText, AlertCircle
} from "lucide-react";

export default function BulkSend() {
  return (
    <DashboardLayout>
      <BulkSendContent />
    </DashboardLayout>
  );
}

type BulkProgress = {
  taskId: number;
  status: string;
  currentIndex: number;
  totalCount: number;
  successCount: number;
  failCount: number;
  lastContact?: { name: string; phoneNumber: string };
  lastResult?: string;
  lastError?: string;
  lastMessage?: string;
};

function BulkSendContent() {
  const utils = trpc.useUtils();
  const { data: devices } = trpc.device.list.useQuery();
  const { data: templates } = trpc.template.list.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.bulk.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const createMut = trpc.bulk.create.useMutation({
    onSuccess: () => {
      utils.bulk.list.invalidate();
      toast.success("群发任务创建成功");
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const startMut = trpc.bulk.start.useMutation({
    onSuccess: () => {
      utils.bulk.list.invalidate();
      toast.success("任务已启动");
    },
    onError: (e) => toast.error(e.message),
  });
  const pauseMut = trpc.bulk.pause.useMutation({
    onSuccess: () => {
      utils.bulk.list.invalidate();
      toast.success("任务已暂停");
    },
    onError: (e) => toast.error(e.message),
  });
  const cancelMut = trpc.bulk.cancel.useMutation({
    onSuccess: () => {
      utils.bulk.list.invalidate();
      toast.success("任务已取消");
    },
    onError: (e) => toast.error(e.message),
  });

  const importMut = trpc.contact.import.useMutation({
    onError: (e) => toast.error(e.message),
  });

  // Create task form state
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"round_robin" | "random">("round_robin");
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [contactsText, setContactsText] = useState("");
  const [contactsFile, setContactsFile] = useState<File | null>(null);

  // Real-time progress from WebSocket
  const [progressMap, setProgressMap] = useState<Record<number, BulkProgress>>({});
  const { user } = useAuth();
  const { on: wsOn } = useDashboardSocket(user?.id);

  useEffect(() => {
    const cleanup = wsOn("bulk_progress", (data: BulkProgress) => {
      setProgressMap(prev => ({ ...prev, [data.taskId]: data }));
      if (data.status === "completed") {
        utils.bulk.list.invalidate();
      }
    });
    return cleanup;
  }, [wsOn, utils]);

  // Parse contacts from text
  const parsedContacts = useMemo(() => {
    if (!contactsText.trim()) return [];
    const lines = contactsText.split("\n").filter(l => l.trim());
    const contacts: { name: string; phoneNumber: string }[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      // Support formats: name,phone  or  name phone  or  name\tphone
      const parts = line.trim().split(/[,，\t\s]+/);
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const phone = parts[parts.length - 1].trim().replace(/[^0-9+]/g, "");
        if (name && phone && !seen.has(phone)) {
          contacts.push({ name, phoneNumber: phone });
          seen.add(phone);
        }
      }
    }
    return contacts;
  }, [contactsText]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setContactsFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContactsText(text);
    };
    reader.readAsText(file);
  }, []);

  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!selectedDeviceId) { toast.error("请选择信使设备"); return; }
    if (selectedTemplateIds.length === 0) { toast.error("请至少选择一个模板"); return; }
    if (parsedContacts.length === 0) { toast.error("请导入联系人数据"); return; }
    if (intervalSeconds < 5) { toast.error("间隔时间不能少于5秒"); return; }

    createMut.mutate({
      deviceId: parseInt(selectedDeviceId),
      mode,
      intervalSeconds,
      templateIds: selectedTemplateIds,
      contacts: parsedContacts,
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "待启动";
      case "running": return "运行中";
      case "paused": return "已暂停";
      case "completed": return "已完成";
      case "cancelled": return "已取消";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "text-amber-400";
      case "running": return "text-emerald-400";
      case "paused": return "text-amber-400";
      case "completed": return "text-blue-400";
      case "cancelled": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  const getDeviceName = (deviceId: number) => {
    return devices?.find(d => d.id === deviceId)?.name || `设备#${deviceId}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-widest text-foreground">群发</h1>
          <p className="text-sm text-muted-foreground font-serif mt-1">
            批量发送短信，支持模板变量替换
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(true);
            setSelectedDeviceId("");
            setSelectedTemplateIds([]);
            setMode("round_robin");
            setIntervalSeconds(10);
            setContactsText("");
            setContactsFile(null);
          }}
          className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif"
        >
          <Plus className="h-4 w-4 mr-1" />
          新建任务
        </Button>
      </div>

      {/* Task list */}
      {tasksLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card className="ink-card">
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-serif">暂无群发任务</p>
            <p className="text-xs text-muted-foreground/60 mt-1 font-body">点击「新建任务」开始批量发送</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => {
            const progress = progressMap[task.id];
            const currentIndex = progress?.currentIndex ?? task.currentIndex;
            const successCount = progress?.successCount ?? task.successCount;
            const failCount = progress?.failCount ?? task.failCount;
            const totalCount = task.totalCount;
            const status = progress?.status ?? task.status;
            const percent = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0;

            return (
              <Card key={task.id} className="ink-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-serif text-foreground text-sm">{getDeviceName(task.deviceId)}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-body">
                          <span className="flex items-center gap-1">
                            {task.mode === "round_robin" ? <RotateCcw className="h-3 w-3" /> : <Shuffle className="h-3 w-3" />}
                            {task.mode === "round_robin" ? "轮流" : "随机"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.intervalSeconds}秒/条
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {totalCount}人
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {JSON.parse(task.templateIds).length}个模板
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-serif ${getStatusColor(status)}`}>
                        {status === "running" && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <Progress value={percent} className="h-2" />
                    <div className="flex items-center justify-between mt-1.5 text-xs font-body text-muted-foreground">
                      <span>{currentIndex} / {totalCount}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> {successCount}
                        </span>
                        <span className="flex items-center gap-1 text-vermilion">
                          <XCircle className="h-3 w-3" /> {failCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last sent info */}
                  {progress?.lastContact && (
                    <div className="text-xs font-body text-muted-foreground/70 mb-3 p-2 rounded bg-foreground/3">
                      最近发送：{progress.lastContact.name}（{progress.lastContact.phoneNumber}）
                      {progress.lastResult === "sent" ? (
                        <span className="text-emerald-400 ml-1">✓ 成功</span>
                      ) : (
                        <span className="text-vermilion ml-1">✗ 失败{progress.lastError ? `（${progress.lastError}）` : ""}</span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {(status === "pending" || status === "paused") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startMut.mutate({ id: task.id })}
                        disabled={startMut.isPending}
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-serif"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        {status === "paused" ? "继续" : "启动"}
                      </Button>
                    )}
                    {status === "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseMut.mutate({ id: task.id })}
                        disabled={pauseMut.isPending}
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-serif"
                      >
                        <Pause className="h-3.5 w-3.5 mr-1" />
                        暂停
                      </Button>
                    )}
                    {(status === "pending" || status === "running" || status === "paused") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("确定取消此任务？")) {
                            cancelMut.mutate({ id: task.id });
                          }
                        }}
                        disabled={cancelMut.isPending}
                        className="border-vermilion/30 text-vermilion hover:bg-vermilion/10 font-serif"
                      >
                        <Square className="h-3.5 w-3.5 mr-1" />
                        取消
                      </Button>
                    )}
                  </div>

                  {/* Created time */}
                  <p className="text-[10px] text-muted-foreground/40 font-body mt-3">
                    创建于 {new Date(task.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create task dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">新建群发任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Step 1: Select device */}
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-2 block flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> 选择信使
              </label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="bg-background border-foreground/20">
                  <SelectValue placeholder="选择要发送的设备" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {devices?.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${d.isOnline ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                        {d.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Import contacts */}
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-2 block flex items-center gap-2">
                <Users className="h-4 w-4" /> 导入联系人
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-foreground/20 hover:border-foreground/40 cursor-pointer transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground font-body">
                        {contactsFile ? contactsFile.name : "上传 TXT/CSV 文件"}
                      </span>
                    </div>
                  </label>
                </div>
                <Textarea
                  value={contactsText}
                  onChange={e => setContactsText(e.target.value)}
                  placeholder={`粘贴联系人数据，每行一条：姓名,手机号\n张三,13800138001\n李四,13800138002\n王五,13800138003`}
                  rows={6}
                  className="bg-background border-foreground/20 font-mono text-xs"
                />
                <div className="flex items-center justify-between text-xs font-body text-muted-foreground">
                  <span>已解析 <span className="text-foreground font-bold">{parsedContacts.length}</span> 个联系人（自动去重）</span>
                  {contactsText && parsedContacts.length === 0 && (
                    <span className="text-vermilion flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> 格式不正确，请检查
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Select templates */}
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-2 block flex items-center gap-2">
                <FileText className="h-4 w-4" /> 选择模板（已选 {selectedTemplateIds.length} 个）
              </label>
              {!templates || templates.length === 0 ? (
                <div className="p-4 rounded border border-foreground/10 text-center">
                  <p className="text-sm text-muted-foreground font-body">暂无模板，请先在「信笺」页面创建</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {templates.map((tpl, idx) => {
                    const selected = selectedTemplateIds.includes(tpl.id);
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => toggleTemplate(tpl.id)}
                        className={`p-3 rounded border cursor-pointer transition-all ${
                          selected
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-foreground/10 hover:border-foreground/20"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            selected ? "border-emerald-500 bg-emerald-500" : "border-foreground/20"
                          }`}>
                            {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-mono text-muted-foreground/50">#{idx + 1}</span>
                              {tpl.label && <span className="text-[10px] text-foreground/60">{tpl.label}</span>}
                            </div>
                            <p className="text-xs font-body text-foreground/80 line-clamp-2">{tpl.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 4: Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-serif text-muted-foreground mb-2 block flex items-center gap-2">
                  {mode === "round_robin" ? <RotateCcw className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
                  发送模式
                </label>
                <Select value={mode} onValueChange={(v) => setMode(v as "round_robin" | "random")}>
                  <SelectTrigger className="bg-background border-foreground/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="round_robin">
                      <span className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5" /> 轮流发送
                      </span>
                    </SelectItem>
                    <SelectItem value="random">
                      <span className="flex items-center gap-2">
                        <Shuffle className="h-3.5 w-3.5" /> 随机发送
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/50 mt-1 font-body">
                  {mode === "round_robin" ? "号码1→模板1，号码2→模板2，循环" : "每个号码随机选择一个模板"}
                </p>
              </div>
              <div>
                <label className="text-sm font-serif text-muted-foreground mb-2 block flex items-center gap-2">
                  <Clock className="h-4 w-4" /> 间隔时间（秒）
                </label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={intervalSeconds}
                  onChange={e => setIntervalSeconds(Math.max(5, parseInt(e.target.value) || 5))}
                  className="bg-background border-foreground/20"
                />
                <p className="text-[10px] text-muted-foreground/50 mt-1 font-body">
                  最低5秒，建议10秒以上
                </p>
              </div>
            </div>

            {/* Summary */}
            {parsedContacts.length > 0 && selectedTemplateIds.length > 0 && (
              <div className="p-3 rounded bg-foreground/3 border border-foreground/10">
                <p className="text-xs font-body text-muted-foreground">
                  将向 <span className="text-foreground font-bold">{parsedContacts.length}</span> 个联系人发送短信，
                  使用 <span className="text-foreground font-bold">{selectedTemplateIds.length}</span> 个模板，
                  {mode === "round_robin" ? "轮流" : "随机"}模式，
                  每条间隔 <span className="text-foreground font-bold">{intervalSeconds}</span> 秒。
                  预计耗时约 <span className="text-foreground font-bold">{Math.ceil(parsedContacts.length * intervalSeconds / 60)}</span> 分钟。
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-foreground/20 font-serif">取消</Button>
            <Button
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif"
            >
              {createMut.isPending ? "创建中..." : "创建任务"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
