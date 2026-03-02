import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, FileText, Info } from "lucide-react";

export default function Templates() {
  return (
    <DashboardLayout>
      <TemplatesContent />
    </DashboardLayout>
  );
}

function TemplatesContent() {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.template.list.useQuery();
  const createMut = trpc.template.create.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      toast.success("模板创建成功");
      setShowCreate(false);
      setNewLabel("");
      setNewContent("");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.template.update.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      toast.success("模板已更新");
      setEditId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.template.delete.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      toast.success("模板已删除");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchText, setBatchText] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleCreate = () => {
    if (!newContent.trim()) {
      toast.error("请输入模板内容");
      return;
    }
    createMut.mutate({ content: newContent.trim(), label: newLabel.trim() || undefined });
  };

  const handleBatchImport = () => {
    const lines = batchText.split("\n").filter(l => l.trim());
    if (lines.length === 0) {
      toast.error("请输入至少一条模板");
      return;
    }
    let created = 0;
    const doNext = () => {
      if (created >= lines.length) {
        utils.template.list.invalidate();
        toast.success(`成功导入 ${lines.length} 条模板`);
        setShowBatchImport(false);
        setBatchText("");
        return;
      }
      const line = lines[created].trim();
      createMut.mutate(
        { content: line, label: `模板${created + 1}` },
        {
          onSuccess: () => {
            created++;
            doNext();
          },
        }
      );
    };
    doNext();
  };

  const handleEdit = (tpl: any) => {
    setEditId(tpl.id);
    setEditLabel(tpl.label || "");
    setEditContent(tpl.content);
  };

  const handleUpdate = () => {
    if (!editContent.trim() || !editId) return;
    updateMut.mutate({ id: editId, content: editContent.trim(), label: editLabel.trim() || undefined });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("已复制到剪贴板");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-widest text-foreground">信笺</h1>
          <p className="text-sm text-muted-foreground font-serif mt-1">
            管理短信模板，支持 <code className="text-vermilion bg-vermilion/10 px-1.5 py-0.5 rounded text-xs">{"{姓名}"}</code> 变量自动替换
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBatchImport(true)}
            className="border-foreground/20 text-foreground hover:bg-foreground/5 font-serif"
          >
            <FileText className="h-4 w-4 mr-1" />
            批量导入
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif"
          >
            <Plus className="h-4 w-4 mr-1" />
            新建模板
          </Button>
        </div>
      </div>

      {/* Variable hint */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
        <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground font-body">
          <p>在模板中使用 <code className="text-vermilion bg-vermilion/10 px-1 rounded">{"{姓名}"}</code> 作为占位符，群发时会自动替换为联系人的姓名。</p>
          <p className="mt-1 text-xs text-muted-foreground/60">示例：「{"{姓名}"}，您好！感谢您的支持。」→ 发送时变为「张三，您好！感谢您的支持。」</p>
        </div>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-lg bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card className="ink-card">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-serif">暂无模板</p>
            <p className="text-xs text-muted-foreground/60 mt-1 font-body">点击「新建模板」或「批量导入」开始创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl, idx) => (
            <Card key={tpl.id} className="ink-card group hover:border-foreground/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      {tpl.label && (
                        <span className="text-xs font-serif text-foreground/70 bg-foreground/5 px-2 py-0.5 rounded">
                          {tpl.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-body text-foreground whitespace-pre-wrap break-all leading-relaxed">
                      {tpl.content.split(/(\{姓名\})/).map((part, i) =>
                        part === "{姓名}" ? (
                          <span key={i} className="text-vermilion bg-vermilion/10 px-1 rounded font-bold">{"{姓名}"}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopy(tpl.content)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(tpl)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-vermilion"
                      onClick={() => {
                        if (confirm("确定删除此模板？")) {
                          deleteMut.mutate({ id: tpl.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">新建信笺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-1 block">标签（可选）</label>
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="如：问候模板、推广模板"
                className="bg-background border-foreground/20"
              />
            </div>
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-1 block">模板内容</label>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder={`输入模板内容，使用 {姓名} 作为变量\n例：{姓名}，您好！这里是XX公司。`}
                rows={5}
                className="bg-background border-foreground/20 font-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-foreground/20 font-serif">取消</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif">
              {createMut.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">编辑信笺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-1 block">标签</label>
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="标签"
                className="bg-background border-foreground/20"
              />
            </div>
            <div>
              <label className="text-sm font-serif text-muted-foreground mb-1 block">模板内容</label>
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={5}
                className="bg-background border-foreground/20 font-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)} className="border-foreground/20 font-serif">取消</Button>
            <Button onClick={handleUpdate} disabled={updateMut.isPending} className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif">
              {updateMut.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch import dialog */}
      <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">批量导入信笺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">每行一条模板，支持 <code className="text-vermilion">{"{姓名}"}</code> 变量</p>
            <Textarea
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              placeholder={`{姓名}，您好！感谢您的支持。\n{姓名}，这里是XX公司，有个好消息告诉您。\n{姓名}，祝您生活愉快！`}
              rows={8}
              className="bg-background border-foreground/20 font-body"
            />
            <p className="text-xs text-muted-foreground/60 font-body">
              共 {batchText.split("\n").filter(l => l.trim()).length} 条模板
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchImport(false)} className="border-foreground/20 font-serif">取消</Button>
            <Button onClick={handleBatchImport} disabled={createMut.isPending} className="bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/15 font-serif">
              {createMut.isPending ? "导入中..." : "导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
