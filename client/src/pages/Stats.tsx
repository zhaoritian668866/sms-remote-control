import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BarChart3, Calendar, Download, Loader2, Users } from "lucide-react";
import { useState, useMemo } from "react";

export default function Stats() {
  const { user } = useAuth();
  const isGlobalViewer = user?.role === "superadmin" || user?.role === "auditor";

  // 日期范围
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 用户组筛选（仅 superadmin/auditor）
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);

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

  // 普通用户查询自己的设备统计
  const { data: myStats, isLoading: myLoading } = trpc.stats.devices.useQuery(
    timeRange,
    { enabled: !!user && !isGlobalViewer }
  );

  // superadmin/auditor 查询全局统计
  const globalInput = useMemo(() => ({
    ...timeRange,
    groupId: selectedGroupId,
  }), [timeRange, selectedGroupId]);

  const { data: allStats, isLoading: allLoading } = trpc.stats.all.useQuery(
    globalInput,
    { enabled: !!user && isGlobalViewer }
  );

  // 获取用户组列表（仅 superadmin/auditor）
  const { data: groups } = trpc.auditor.groups.useQuery(undefined, {
    enabled: isGlobalViewer,
  });

  const stats = isGlobalViewer ? allStats : myStats;
  const isLoading = isGlobalViewer ? allLoading : myLoading;

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

  // 按用户分组统计（仅全局视图）
  const userGroupedStats = useMemo(() => {
    if (!isGlobalViewer || !allStats || allStats.length === 0) return null;
    const grouped = new Map<string, { userName: string; devices: typeof allStats; totalSent: number; singleReply: number; multiReply: number }>();
    for (const row of allStats) {
      const key = row.userName;
      if (!grouped.has(key)) {
        grouped.set(key, { userName: key, devices: [], totalSent: 0, singleReply: 0, multiReply: 0 });
      }
      const g = grouped.get(key)!;
      g.devices.push(row);
      g.totalSent += row.totalSent;
      g.singleReply += row.singleReply;
      g.multiReply += row.multiReply;
    }
    return Array.from(grouped.values());
  }, [isGlobalViewer, allStats]);

  // 导出 CSV
  const handleExport = () => {
    if (!stats || stats.length === 0) return;
    let csv = "\uFEFF";
    if (isGlobalViewer && allStats) {
      csv += "用户,信使名称,已发送,单条回复,多条回复\n";
      csv += allStats.map(s => `${s.userName},${s.deviceName},${s.totalSent},${s.singleReply},${s.multiReply}`).join("\n");
    } else {
      csv += "信使名称,已发送,单条回复,多条回复\n";
      csv += stats.map(s => `${s.deviceName},${s.totalSent},${s.singleReply},${s.multiReply}`).join("\n");
    }
    csv += `\n合计,,${totals.totalSent},${totals.singleReply},${totals.multiReply}`;
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-foreground/60" />
            <h1 className="text-xl font-display tracking-widest text-foreground">
              {isGlobalViewer ? "全局统计" : "数据统计"}
            </h1>
            {isGlobalViewer && (
              <span className="text-xs font-body text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 rounded">
                <Users className="w-3 h-3 inline mr-1" />
                {user?.role === "superadmin" ? "总后台" : "审计员"}
              </span>
            )}
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
            <span className="text-sm font-serif text-foreground">筛选条件</span>
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

          {/* 用户组筛选（仅 superadmin/auditor） */}
          {isGlobalViewer && groups && groups.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-serif text-muted-foreground">用户组：</span>
              <button
                onClick={() => setSelectedGroupId(undefined)}
                className={`px-2.5 py-1 text-xs font-serif border rounded transition-colors ${
                  selectedGroupId === undefined
                    ? "bg-foreground/10 text-foreground border-foreground/20"
                    : "text-muted-foreground hover:text-foreground border-foreground/10 hover:bg-foreground/5"
                }`}
              >
                全部
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`px-2.5 py-1 text-xs font-serif border rounded transition-colors ${
                    selectedGroupId === g.id
                      ? "bg-foreground/10 text-foreground border-foreground/20"
                      : "text-muted-foreground hover:text-foreground border-foreground/10 hover:bg-foreground/5"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

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
              <span className="text-xs font-body mt-1">
                {isGlobalViewer ? "当前筛选条件下无统计数据" : "请先配对信使并发送短信"}
              </span>
            </div>
          ) : isGlobalViewer && userGroupedStats ? (
            /* 全局视图：按用户分组显示 */
            <table className="w-full">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                  <th className="text-left px-4 py-3 text-xs font-serif text-muted-foreground tracking-wider">
                    用户
                  </th>
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
                {userGroupedStats.map((group) => (
                  <>
                    {group.devices.map((row, idx) => (
                      <tr
                        key={row.deviceId}
                        className="border-b border-foreground/5 hover:bg-foreground/[0.02] transition-colors"
                      >
                        {idx === 0 ? (
                          <td
                            className="px-4 py-3 text-sm font-serif text-foreground align-top"
                            rowSpan={group.devices.length}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-body text-foreground/60">
                                {group.userName.charAt(0).toUpperCase()}
                              </div>
                              <span>{group.userName}</span>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-sm font-serif text-foreground/80">
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
                    {/* 用户小计 */}
                    {group.devices.length > 1 && (
                      <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                        <td className="px-4 py-2 text-xs font-serif text-muted-foreground" colSpan={2}>
                          {group.userName} 小计
                        </td>
                        <td className="px-4 py-2 text-xs font-body text-center text-foreground/70 font-medium">
                          {group.totalSent}
                        </td>
                        <td className="px-4 py-2 text-xs font-body text-center font-medium">
                          <span className="text-jade/80">{group.singleReply}</span>
                        </td>
                        <td className="px-4 py-2 text-xs font-body text-center font-medium">
                          <span className="text-amber-500/80">{group.multiReply}</span>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/15 bg-foreground/[0.03]">
                  <td className="px-4 py-3 text-sm font-serif text-foreground font-bold" colSpan={2}>
                    总计
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
          ) : (
            /* 普通用户视图 */
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
