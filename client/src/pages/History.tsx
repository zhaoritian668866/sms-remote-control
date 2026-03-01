import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { CyberPanel } from "@/components/CyberPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
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

  const { data: messageList, isLoading } = trpc.sms.list.useQuery(queryInput, {
    enabled: !!user,
  });

  const getDeviceName = (deviceId: number) => {
    const device = deviceList?.find(d => d.id === deviceId);
    return device?.name || `Device #${deviceId}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wider text-neon-cyan neon-glow-cyan">
            MESSAGE HISTORY
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            // SEARCH & FILTER SMS RECORDS
          </p>
        </div>

        {/* Search & Filter */}
        <CyberPanel title="SEARCH FILTERS" accentColor="purple">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="搜索手机号、联系人或短信内容..."
                className="pl-10 bg-background/50 border-neon-purple/30 text-foreground font-body text-sm"
              />
            </div>
            <Select value={selectedDeviceId} onValueChange={v => { setSelectedDeviceId(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-48 bg-background/50 border-neon-purple/30 text-foreground font-mono text-sm">
                <SelectValue placeholder="ALL DEVICES" />
              </SelectTrigger>
              <SelectContent className="bg-cyber-dark border-neon-purple/30">
                <SelectItem value="all" className="font-mono text-sm">ALL DEVICES</SelectItem>
                {deviceList?.map(device => (
                  <SelectItem key={device.id} value={device.id.toString()} className="font-mono text-sm">
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CyberPanel>

        {/* Results */}
        <CyberPanel title="SEARCH RESULTS" subtitle={`Page ${page + 1}`} noPadding>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin mx-auto" />
              <p className="text-sm font-mono text-muted-foreground mt-3">SCANNING RECORDS...</p>
            </div>
          ) : !messageList || messageList.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-neon-cyan/20 mx-auto mb-3" />
              <p className="text-sm font-mono text-muted-foreground">NO RECORDS FOUND</p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-mono text-muted-foreground border-b border-border/30 bg-background/30">
                <div className="col-span-1">DIR</div>
                <div className="col-span-2">PHONE</div>
                <div className="col-span-1">CONTACT</div>
                <div className="col-span-4">MESSAGE</div>
                <div className="col-span-2">DEVICE</div>
                <div className="col-span-2">TIME</div>
              </div>

              <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto">
                {messageList.map(msg => (
                  <div key={msg.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 hover:bg-neon-cyan/5 transition-colors items-start">
                    <div className="col-span-1 flex items-center">
                      {msg.direction === "incoming" ? (
                        <ArrowDownLeft className="w-4 h-4 text-neon-green" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-neon-pink" />
                      )}
                    </div>
                    <div className="col-span-2 text-sm font-mono text-neon-cyan">{msg.phoneNumber}</div>
                    <div className="col-span-1 text-xs font-body text-muted-foreground truncate">{msg.contactName || "-"}</div>
                    <div className="col-span-4 text-sm font-body text-foreground/80 break-all">{msg.body}</div>
                    <div className="col-span-2 text-xs font-mono text-muted-foreground">{getDeviceName(msg.deviceId)}</div>
                    <div className="col-span-2 text-xs font-mono text-muted-foreground">
                      {new Date(msg.smsTimestamp).toLocaleString("zh-CN")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
                <Button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  variant="outline"
                  size="sm"
                  className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
                >
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  PREV
                </Button>
                <span className="text-xs font-mono text-muted-foreground">
                  SHOWING {page * pageSize + 1} - {page * pageSize + (messageList?.length || 0)}
                </span>
                <Button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!messageList || messageList.length < pageSize}
                  variant="outline"
                  size="sm"
                  className="border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10 font-mono text-xs"
                >
                  NEXT
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CyberPanel>
      </div>
    </DashboardLayout>
  );
}
