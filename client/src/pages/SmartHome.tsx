import { useAuth } from "@/_core/hooks/useAuth";
import Home from "./Home";
import Landing from "./Landing";

export default function SmartHome() {
  const { user, loading } = useAuth();

  // 加载中时显示简单的加载状态，避免闪烁
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <span className="text-lg font-serif tracking-[0.2em] text-foreground/40">飞鸽传书</span>
          <div className="w-8 h-px bg-foreground/10 mx-auto mt-3" />
        </div>
      </div>
    );
  }

  // 已登录 → 控制台仪表盘
  if (user) {
    return <Home />;
  }

  // 未登录 → 官网落地页
  return <Landing />;
}
