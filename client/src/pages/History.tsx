import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Search, History as HistoryIcon, ArrowDownLeft, ArrowUpRight,
  ChevronLeft, ChevronRight, Filter
} from "lucide-react";
import { useState, useMemo } from "react";

export default function History() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: deviceList } = trpc.device.list.useQuery(undefined, { enabled: !!user });

  const queryInput = useMemo(() => ({
    deviceId: selectedDeviceId !== "all" ? parseInt(selectedDeviceId) : undefined,
    search: search.trim() || undefined,
    limit: pageSize,
    offset: page * pageSize,
  }), [selectedDeviceId, search, page]);

  const { data: messageList, isLoading } = trpc.sms.list.useQuery(queryInput, { enabled: !!user });

  const getDeviceName = (deviceId: number) => {
    const device = deviceList?.find(d => d.id === deviceId);
    return device?.name || `信使 #${deviceId}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-widest text-foreground">
            卷宗查阅
          </h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            搜索和查阅所有传书历史记录
          </p>
        </div>

        <CyberPanel title="筛选条件">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="搜索号码、联系人或内容..."
                  className="pl-9 bg-background/50 border-foreground/15 text-foreground font-body text-sm"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={selectedDeviceId} onValueChange={v => { setSelectedDeviceId(v); setPage(0); }}>
                <SelectTrigger className="bg-background/50 border-foreground/15 text-foreground font-body text-sm">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="筛选信使" />
                </SelectTrigger>
                <SelectContent className="bg-card border-foreground/15">
                  <SelectItem value="all" className="font-body text-sm">全部信使</SelectItem>
                  {deviceList?.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()} className="font-body text-sm">
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CyberPanel>

        <CyberPanel title="传书卷宗" subtitle={`第 ${page + 1} 页`} noPadding>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-foreground/10 border-t-foreground/40 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-body text-muted-foreground">查阅中...</p>
            </div>
          ) : !messageList || messageList.length === 0 ? (
            <div className="text-center py-12">
              <HistoryIcon className="w-12 h-12 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm font-body text-muted-foreground">
                {search ? "未找到匹配的传书记录" : "暂无传书记录"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-foreground/5">
                {messageList.map(msg => (
                  <div key={msg.id} className="px-4 py-3 hover:bg-foreground/3 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {msg.direction === "incoming" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-jade" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-vermilion" />
                        )}
                        <span className="text-sm font-body text-foreground/80">
                          {msg.phoneNumber}
                        </span>
                        {msg.contactName && (
                          <span className="text-xs font-body text-muted-foreground">
                            （{msg.contactName}）
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-body text-muted-foreground/50">
                          {getDeviceName(msg.deviceId)}
                        </span>
                        <span className="text-xs font-body text-muted-foreground">
                          {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-body text-foreground/70 pl-5.5 whitespace-pre-wrap break-all">
                      {msg.body}
                    </p>
                    <div className="flex items-center gap-2 mt-1 pl-5.5">
                      <span className={`text-xs font-body px-1.5 py-0.5 ${
                        msg.direction === "incoming"
                          ? "bg-jade/10 text-jade border border-jade/20"
                          : "bg-vermilion/10 text-vermilion border border-vermilion/20"
                      }`}>
                        {msg.direction === "incoming" ? "收信" : "发信"}
                      </span>
                      <span className={`text-xs font-body px-1.5 py-0.5 border ${
                        msg.status === "delivered" || msg.status === "received"
                          ? "bg-jade/10 text-jade border-jade/20"
                          : msg.status === "failed"
                          ? "bg-vermilion/10 text-vermilion border-vermilion/20"
                          : "bg-muted/30 text-muted-foreground border-foreground/10"
                      }`}>
                        {msg.status === "delivered" ? "已送达" :
                         msg.status === "received" ? "已接收" :
                         msg.status === "sent" ? "已发送" :
                         msg.status === "failed" ? "失败" :
                         msg.status === "pending" ? "发送中" : msg.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5">
                <Button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  variant="outline"
                  size="sm"
                  className="border-foreground/15 text-foreground hover:bg-foreground/5 font-body text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  上一页
                </Button>
                <span className="text-xs font-body text-muted-foreground">
                  显示 {page * pageSize + 1} - {page * pageSize + (messageList?.length ?? 0)} 条
                </span>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!messageList || messageList.length < pageSize}
                  variant="outline"
                  size="sm"
                  className="border-foreground/15 text-foreground hover:bg-foreground/5 font-body text-xs"
                >
                  下一页
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CyberPanel>
      </div>
    </DashboardLayout>
  );
}
