import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, Download, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

export default function Stats() {
  const { user } = useAuth();

  // 日期范围
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 转换日期为时间戳
  const timeRange = useMemo(() => {
    const result: { startTime?: number; endTime?: number } = {};
    if (startDate) {
      result.startTime = new Date(startDate + "T00:00:00").getTime();
    }
    if (endDate) {
      result.endTime = new Date(endDate + "T23:59:59.999").getTime();
    }
    return result;
  }, [startDate, endDate]);

  const { data: stats, isLoading } = trpc.stats.devices.useQuery(
    timeRange,
    { enabled: !!user }
  );

  // 汇总
  const totals = useMemo(() => {
    if (!stats || stats.length === 0) return { totalSent: 0, singleReply: 0, multiReply: 0 };
    return stats.reduce(
      (acc, s) => ({
        totalSent: acc.totalSent + s.totalSent,
        singleReply: acc.singleReply + s.singleReply,
        multiReply: acc.multiReply + s.multiReply,
      }),
      { totalSent: 0, singleReply: 0, multiReply: 0 }
    );
  }, [stats]);

  // 导出 CSV
  const handleExport = () => {
    if (!stats || stats.length === 0) return;
    const header = "设备名称,已发送,单条回复,多条回复\n";
    const rows = stats.map(s => `${s.deviceName},${s.totalSent},${s.singleReply},${s.multiReply}`).join("\n");
    const footer = `\n合计,${totals.totalSent},${totals.singleReply},${totals.multiReply}`;
    const csv = "\uFEFF" + header + rows + footer;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = startDate && endDate ? `_${startDate}_${endDate}` : "";
    a.download = `统计报表${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 快捷日期
  const setToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    setStartDate(monday.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const clearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-foreground/60" />
            <h1 className="text-xl font-display tracking-widest text-foreground">数据统计</h1>
          </div>
          {stats && stats.length > 0 && (
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="text-xs font-serif border-foreground/15 text-foreground/70 hover:text-foreground"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              导出报表
            </Button>
          )}
        </div>

        {/* 日期筛选 */}
        <div className="ink-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-serif text-foreground">日期筛选</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-8 text-xs bg-background/50 border-foreground/10 text-foreground font-body w-36"
              />
              <span className="text-xs text-muted-foreground font-body">至</span>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-8 text-xs bg-background/50 border-foreground/10 text-foreground font-body w-36"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={setToday}
                className="px-2.5 py-1 text-xs font-serif text-muted-foreground hover:text-foreground border border-foreground/10 rounded hover:bg-foreground/5 transition-colors"
              >
                今日
              </button>
              <button
                onClick={setThisWeek}
                className="px-2.5 py-1 text-xs font-serif text-muted-foreground hover:text-foreground border border-foreground/10 rounded hover:bg-foreground/5 transition-colors"
              >
                本周
              </button>
              <button
                onClick={setThisMonth}
                className="px-2.5 py-1 text-xs font-serif text-muted-foreground hover:text-foreground border border-foreground/10 rounded hover:bg-foreground/5 transition-colors"
              >
                本月
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={clearDates}
                  className="px-2.5 py-1 text-xs font-serif text-vermilion/70 hover:text-vermilion border border-vermilion/20 rounded hover:bg-vermilion/5 transition-colors"
                >
                  清除
                </button>
              )}
            </div>
          </div>
          {(startDate || endDate) && (
            <p className="text-xs font-body text-muted-foreground/60 mt-2">
              {startDate && endDate
                ? `筛选范围：${startDate} 至 ${endDate}`
                : startDate
                  ? `筛选范围：${startDate} 起`
                  : `筛选范围：至 ${endDate}`}
            </p>
          )}
        </div>

        {/* 统计表格 */}
        <div className="ink-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm font-body text-muted-foreground">统计中...</span>
            </div>
          ) : !stats || stats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
              <BarChart3 className="w-8 h-8 mb-3" />
              <span className="text-sm font-body">暂无数据</span>
              <span className="text-xs font-body mt-1">请先配对信使并发送短信</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                  <th className="text-left px-4 py-3 text-xs font-serif text-muted-foreground tracking-wider">
                    信使名称
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-serif text-muted-foreground tracking-wider">
                    已发送
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-serif text-muted-foreground tracking-wider">
                    单条回复
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-serif text-muted-foreground tracking-wider">
                    多条回复
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr
                    key={row.deviceId}
                    className="border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-serif text-foreground">
                      {row.deviceName}
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-center text-foreground/80">
                      {row.totalSent}
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-center">
                      <span className="text-jade">{row.singleReply}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-center">
                      <span className="text-amber-500">{row.multiReply}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.03]">
                  <td className="px-4 py-3 text-sm font-serif text-foreground font-bold">
                    合计
                  </td>
                  <td className="px-4 py-3 text-sm font-body text-center text-foreground font-bold">
                    {totals.totalSent}
                  </td>
                  <td className="px-4 py-3 text-sm font-body text-center font-bold">
                    <span className="text-jade">{totals.singleReply}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-body text-center font-bold">
                    <span className="text-amber-500">{totals.multiReply}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* 说明 */}
        <div className="text-xs font-body text-muted-foreground/50 space-y-1 px-1">
          <p>· <strong>已发送</strong>：该信使在筛选时间范围内发出的短信总数</p>
          <p>· <strong>单条回复</strong>：对方只回复了一条消息的联系人数量</p>
          <p>· <strong>多条回复</strong>：对方回复了两条及以上消息的联系人数量</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
