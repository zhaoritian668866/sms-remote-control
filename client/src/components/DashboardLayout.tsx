import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useUnreadCounts } from "@/hooks/useUnread";
import { Smartphone, MessageSquare, History, LayoutDashboard, LogOut, PanelLeft, Crown, Building2, FileDown, FileText, Zap, Eye } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen ink-wash-bg">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="ink-card p-10 w-full">
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-3xl font-display text-foreground tracking-widest">
                飞鸽传书
              </h1>
              <div className="ink-line w-32" />
              <p className="text-sm text-muted-foreground text-center font-serif">
                短信远程控制系统
              </p>
              <p className="text-xs text-muted-foreground/60 text-center font-body">
                请先登录以进入控制台
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full mt-8 bg-foreground/5 border border-foreground/20 text-foreground hover:bg-foreground/10 font-serif tracking-widest"
            >
              入 门
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { total: totalUnread } = useUnreadCounts();

  const isAuditor = user?.role === "auditor";

  const menuItems = isAuditor ? [
    { icon: Eye, label: "审计台", path: "/auditor" },
  ] : [
    { icon: LayoutDashboard, label: "总堂", path: "/" },
    { icon: Smartphone, label: "信使", path: "/devices", showUnread: true },
    { icon: MessageSquare, label: "传书", path: "/messages" },
    { icon: History, label: "卷宗", path: "/history" },
    ...(user?.role === "superadmin" ? [{ icon: Crown, label: "总后台", path: "/admin" }] : []),
    ...(user?.role === "admin" ? [{ icon: Building2, label: "子后台", path: "/sub-admin" }] : []),
    { icon: FileText, label: "信笺", path: "/templates" },
    { icon: Zap, label: "群发", path: "/bulk-send" },
    { icon: FileDown, label: "导出", path: "/export" },
  ];

  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-foreground/10"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-foreground/10">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-foreground/5 rounded transition-colors focus:outline-none shrink-0"
                aria-label="收起导航"
              >
                <PanelLeft className="h-4 w-4 text-foreground/60" />
              </button>
              {!isCollapsed ? (
                <span className="font-display text-lg tracking-widest text-foreground truncate">
                  飞鸽传书
                </span>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-3">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path === "/devices" && location.startsWith("/chat/"));
                const showBadge = item.showUnread && totalUnread > 0;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-serif text-sm tracking-wider relative ${
                        isActive
                          ? "bg-foreground/8 text-foreground border-l-2 border-foreground/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      <div className="relative">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-foreground" : ""}`} />
                        {showBadge && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-vermilion text-white text-[10px] font-body font-bold flex items-center justify-center leading-none">
                            {totalUnread > 99 ? "99+" : totalUnread}
                          </span>
                        )}
                      </div>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-foreground/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded px-1 py-1 hover:bg-foreground/5 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 border border-foreground/20 shrink-0">
                    <AvatarFallback className="text-xs font-serif bg-foreground/5 text-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-serif truncate leading-none text-foreground">
                      {user?.name || "无名侠"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1 font-body">
                      @{user?.username || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-vermilion hover:text-vermilion focus:text-vermilion font-serif text-sm"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出江湖</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-foreground/10 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b border-foreground/10 h-14 items-center justify-between bg-card/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded bg-background text-foreground" />
              <span className="tracking-wider text-foreground font-serif text-sm">
                {activeMenuItem?.label ?? "菜单"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 ink-wash-bg min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
