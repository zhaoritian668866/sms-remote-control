import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, Check, Square, CheckSquare, FileDown, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function ExportNumbers() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing" | "">("");
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());

  const startTime = startDate ? new Date(startDate).getTime() : undefined;
  const endTime = endDate ? new Date(endDate + "T23:59:59").getTime() : undefined;

  const { data: numbers, isLoading, refetch } = trpc.sms.exportNumbers.useQuery({
    startTime,
    endTime,
    direction: direction || undefined,
  });

  const allSelected = numbers && numbers.length > 0 && selectedNumbers.size === numbers.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedNumbers(new Set());
    } else if (numbers) {
      setSelectedNumbers(new Set(numbers));
    }
  };

  const toggleNumber = (num: string) => {
    const next = new Set(selectedNumbers);
    if (next.has(num)) {
      next.delete(num);
    } else {
      next.add(num);
    }
    setSelectedNumbers(next);
  };

  const handleExport = () => {
    const toExport = selectedNumbers.size > 0 ? Array.from(selectedNumbers) : (numbers || []);
    if (toExport.length === 0) {
      toast.error("没有可导出的号码");
      return;
    }

    const csvContent = "电话号码\n" + toExport.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phone_numbers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${toExport.length} 个号码`);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-3 mb-4">
            <FileDown className="w-5 h-5 text-foreground/60" />
            <h1 className="text-lg font-serif text-foreground tracking-wider">号码导出</h1>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-xs font-body text-muted-foreground/50">筛选：</span>
            </div>
            <select
              value={direction}
              onChange={e => setDirection(e.target.value as any)}
              className="h-8 px-3 bg-background/60 border border-foreground/10 text-sm font-body text-foreground rounded"
            >
              <option value="">全部方向</option>
              <option value="outgoing">已发送</option>
              <option value="incoming">已接收</option>
            </select>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-36 bg-background/60 border-foreground/10 text-sm font-body" placeholder="开始日期" />
            <span className="text-xs text-muted-foreground/40">至</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-36 bg-background/60 border-foreground/10 text-sm font-body" placeholder="结束日期" />

            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={toggleAll} className="h-8 px-3 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
                {allSelected ? <CheckSquare className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                {allSelected ? "取消全选" : "全选"}
              </Button>
              <Button size="sm" onClick={handleExport} className="h-8 px-4 bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/20 text-xs font-body">
                <Download className="w-3 h-3 mr-1" />
                导出 CSV {selectedNumbers.size > 0 ? `(${selectedNumbers.size})` : numbers ? `(${numbers.length})` : ""}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-foreground/40" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {numbers?.map(num => {
                const isSelected = selectedNumbers.has(num);
                return (
                  <button
                    key={num}
                    onClick={() => toggleNumber(num)}
                    className={`flex items-center gap-2 px-3 py-2 border text-sm font-body transition-colors text-left ${
                      isSelected
                        ? "bg-foreground/10 border-foreground/20 text-foreground"
                        : "bg-card/40 border-foreground/8 text-foreground/70 hover:bg-foreground/5"
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-foreground/60 shrink-0" /> : <Square className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
                    <span className="truncate">{num}</span>
                  </button>
                );
              })}
              {(!numbers || numbers.length === 0) && (
                <div className="col-span-full text-center py-10 text-muted-foreground/40 font-body text-sm">
                  暂无号码数据，请调整筛选条件
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
