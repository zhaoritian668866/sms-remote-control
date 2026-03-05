import { Download, Shield, Zap, Smartphone, MessageSquare, Users, ChevronDown, Send, Settings, BatteryCharging, Wifi, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import InkCanvas from "@/components/InkCanvas";

const INK_MOUNTAIN_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663393087442/4rTHqCojuh9Vnb7GsHmjrf/ink-mountain-bg2_dffcde5e.jpg";
const APK_DOWNLOAD_URL = "/api/download/apk";
const TG_URL = "https://t.me/byfc888";

// 滚动渐入 Hook
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// 滚动渐入包装组件
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(30px)",
        transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// 毛笔书写效果标题
function BrushTitle({ text, className = "" }: { text: string; className?: string }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      <div
        className="absolute bottom-0 left-0 h-[3px] bg-vermilion/30"
        style={{
          width: isVisible ? "100%" : "0%",
          transition: "width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s",
        }}
      />
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [navSolid, setNavSolid] = useState(false);

  // 导航栏滚动变实
  useEffect(() => {
    const handleScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* 全局水墨粒子 Canvas */}
      <InkCanvas />

      {/* ═══ 导航栏 ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          backgroundColor: navSolid ? "rgba(15, 15, 18, 0.95)" : "transparent",
          borderBottom: navSolid ? "1px solid rgba(200,195,185,0.08)" : "1px solid transparent",
          backdropFilter: navSolid ? "blur(12px)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-serif tracking-[0.2em] text-foreground">飞鸽传书</span>
            <div className="hidden sm:block w-px h-4 bg-foreground/15" />
            <span className="hidden sm:block text-xs font-body text-muted-foreground">短信远程控制系统</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => scrollToSection("features")} className="hidden sm:block text-xs font-body text-muted-foreground hover:text-foreground transition-colors">功能</button>
            <button onClick={() => scrollToSection("guide")} className="hidden sm:block text-xs font-body text-muted-foreground hover:text-foreground transition-colors">使用指南</button>
            <button onClick={() => scrollToSection("settings")} className="hidden sm:block text-xs font-body text-muted-foreground hover:text-foreground transition-colors">设置</button>
            <button onClick={() => scrollToSection("contact")} className="hidden sm:block text-xs font-body text-muted-foreground hover:text-foreground transition-colors">联系</button>
            <button
              onClick={() => setLocation("/login")}
              className="text-xs font-serif tracking-wider px-4 py-1.5 border border-foreground/20 text-foreground hover:bg-foreground/10 transition-all hover:border-foreground/40"
            >
              登录系统
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ 首屏 Hero ═══ */}
      <section className="relative min-h-screen flex items-center justify-center pt-14">
        {/* 水墨山水背景 */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute bottom-0 left-0 right-0 h-[60%] opacity-[0.07]"
            style={{
              backgroundImage: `url(${INK_MOUNTAIN_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center bottom",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40%)",
            }}
          />
          {/* 角落墨线 - 带动画 */}
          <div className="absolute top-20 left-6 w-12 h-px bg-foreground/8 animate-[brush-stroke_1.5s_ease-out]" />
          <div className="absolute top-20 left-6 w-px h-12 bg-foreground/8 animate-[brush-stroke-v_1.5s_ease-out]" />
          <div className="absolute bottom-6 right-6 w-12 h-px bg-foreground/8 animate-[brush-stroke_1.5s_ease-out_0.5s_both]" />
          <div className="absolute bottom-6 right-6 w-px h-12 bg-foreground/8 animate-[brush-stroke-v_1.5s_ease-out_0.5s_both]" />
        </div>

        <div className="relative text-center px-4 max-w-3xl mx-auto z-10">
          {/* 印章 - 旋转入场 */}
          <div className="inline-block mb-8 animate-[seal-stamp_0.6s_ease-out_0.3s_both]">
            <span
              className="text-vermilion border-2 border-vermilion px-3 py-1 font-display text-sm tracking-widest"
              style={{ transform: "rotate(-3deg)", display: "inline-block" }}
            >
              飞鸽
            </span>
          </div>

          {/* 主标题 - 逐字显现 */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display tracking-[0.15em] text-foreground mb-4 leading-tight animate-[ink-fade_1s_ease-out_0.5s_both]">
            飞鸽传书
          </h1>
          <div className="w-20 h-px bg-foreground/20 mx-auto mb-4 animate-[brush-stroke_1.2s_ease-out_0.8s_both]" />
          <p className="text-lg sm:text-xl font-serif text-foreground/70 tracking-[0.1em] mb-2 animate-[ink-fade_1s_ease-out_1s_both]">
            千里传音，一指掌控
          </p>
          <p className="text-sm font-body text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed animate-[ink-fade_1s_ease-out_1.2s_both]">
            远程管理多台手机短信收发，实时同步、安全加密、永不断线。<br />
            江湖虽远，飞鸽可达。
          </p>

          {/* 下载按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-[ink-fade_1s_ease-out_1.4s_both]">
            <a
              href={APK_DOWNLOAD_URL}
              download="飞鸽传书-v3.0.0.apk"
              className="group flex items-center gap-3 px-8 py-3.5 bg-foreground/10 border border-foreground/20 hover:bg-vermilion/10 hover:border-vermilion/30 transition-all duration-300"
            >
              <Download className="w-5 h-5 text-vermilion group-hover:animate-bounce" />
              <div className="text-left">
                <span className="block text-sm font-serif tracking-wider text-foreground">下载 Android 客户端</span>
                <span className="block text-xs font-body text-muted-foreground">v3.0.0 · 26.5 MB</span>
              </div>
            </a>
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center gap-2 px-8 py-3.5 border border-foreground/10 hover:border-foreground/20 transition-all text-sm font-serif tracking-wider text-foreground/70 hover:text-foreground"
            >
              进入控制台
            </button>
          </div>

          {/* 向下滚动提示 */}
          <button onClick={() => scrollToSection("features")} className="animate-bounce text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors">
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* ═══ 功能亮点 ═══ */}
      <section id="features" className="relative py-24 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <span className="text-xs font-body text-vermilion tracking-[0.3em] uppercase">核心功能</span>
            <h2 className="text-3xl font-display tracking-[0.15em] text-foreground mt-3 mb-3">
              <BrushTitle text="六大利器" />
            </h2>
            <div className="w-12 h-px bg-foreground/20 mx-auto" />
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Smartphone className="w-6 h-6" />, title: "多机管控", desc: "同时管理多台手机，每台设备独立会话，互不干扰。总后台一览全局，子后台分级管理。" },
              { icon: <MessageSquare className="w-6 h-6" />, title: "实时收发", desc: "短信实时同步到控制端，支持远程发送短信，延迟低至毫秒级。新消息即时弹窗通知。" },
              { icon: <Zap className="w-6 h-6" />, title: "群发引擎", desc: "内置群发任务系统，支持模板变量替换、定时发送、随机间隔，批量操作高效省心。" },
              { icon: <Shield className="w-6 h-6" />, title: "安全加密", desc: "全链路 TLS 1.3 加密传输，WebSocket 安全通道。三级权限体系，数据隔离，滴水不漏。" },
              { icon: <Users className="w-6 h-6" />, title: "团队协作", desc: "超级管理员 → 子后台管理员 → 一线人员，三级架构。用户组独立管理，配额灵活分配。" },
              { icon: <BatteryCharging className="w-6 h-6" />, title: "永不断线", desc: "手机端前台服务 + WakeLock + 心跳保活 + 网络切换自动重连 + 开机自启，7×24 小时在线。" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="group p-6 bg-card/50 border border-foreground/5 hover:border-vermilion/20 transition-all duration-500 relative h-full hover:bg-card/80">
                  {/* 左上角装饰 */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-foreground/10 group-hover:border-vermilion/40 group-hover:w-6 group-hover:h-6 transition-all duration-500" />
                  {/* 右下角装饰 */}
                  <div className="absolute bottom-0 right-0 w-0 h-0 border-b border-r border-transparent group-hover:border-vermilion/20 group-hover:w-4 group-hover:h-4 transition-all duration-500" />
                  <div className="text-vermilion/70 mb-4 group-hover:text-vermilion transition-colors duration-300">{item.icon}</div>
                  <h3 className="text-base font-serif tracking-[0.1em] text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 使用指南 ═══ */}
      <section id="guide" className="relative py-24 px-4 bg-card/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <span className="text-xs font-body text-jade tracking-[0.3em] uppercase">快速上手</span>
            <h2 className="text-3xl font-display tracking-[0.15em] text-foreground mt-3 mb-3">
              <BrushTitle text="四步入门" />
            </h2>
            <div className="w-12 h-px bg-foreground/20 mx-auto" />
          </Reveal>

          <div className="space-y-0">
            {[
              {
                step: "壹",
                title: "下载安装",
                desc: "在需要被控制的手机上下载并安装「飞鸽传书」APK。安装时如提示『未知来源』，请在设置中允许安装。",
                icon: <Download className="w-5 h-5" />,
              },
              {
                step: "贰",
                title: "权限授予",
                desc: "首次打开 APP 后，请依次授予短信读取、短信发送、通讯录读取权限。这些权限是短信收发功能的必要条件。",
                icon: <Shield className="w-5 h-5" />,
              },
              {
                step: "叁",
                title: "扫码配对",
                desc: "在电脑端登录控制台，进入「信使管理」生成配对二维码。打开手机 APP 扫描二维码，或手动输入配对令牌完成绑定。",
                icon: <Smartphone className="w-5 h-5" />,
              },
              {
                step: "肆",
                title: "开始使用",
                desc: "配对成功后，手机短信将实时同步到控制台。您可以在控制台查看、回复、群发短信，管理多台设备。",
                icon: <Send className="w-5 h-5" />,
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.15}>
                <div className="flex gap-6 items-start group py-6">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className="w-14 h-14 flex items-center justify-center border border-foreground/10 group-hover:border-vermilion/40 transition-all duration-500 relative bg-background">
                      <span className="text-xl font-display text-vermilion/70 group-hover:text-vermilion transition-colors">{item.step}</span>
                    </div>
                    {i < 3 && (
                      <div className="w-px h-8 bg-gradient-to-b from-foreground/10 to-transparent mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-muted-foreground/50 group-hover:text-jade/70 transition-colors">{item.icon}</span>
                      <h3 className="text-base font-serif tracking-[0.1em] text-foreground">{item.title}</h3>
                    </div>
                    <p className="text-sm font-body text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 手机端设置注意事项 ═══ */}
      <section id="settings" className="relative py-24 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <span className="text-xs font-body text-gold tracking-[0.3em] uppercase">重要提示</span>
            <h2 className="text-3xl font-display tracking-[0.15em] text-foreground mt-3 mb-3">
              <BrushTitle text="手机端设置" />
            </h2>
            <div className="w-12 h-px bg-foreground/20 mx-auto mb-4" />
            <p className="text-sm font-body text-muted-foreground">为确保 APP 稳定运行、永不断线，请务必完成以下设置</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <BatteryCharging className="w-5 h-5" />,
                title: "关闭电池优化",
                items: [
                  "进入 设置 → 电池 → 电池优化",
                  "找到「飞鸽传书」，选择「不优化」或「无限制」",
                  "部分手机路径：设置 → 应用 → 飞鸽传书 → 电池 → 不受限制",
                ],
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: "允许自启动",
                items: [
                  "进入 设置 → 应用 → 飞鸽传书 → 权限",
                  "开启「自启动」「后台运行」权限",
                  "华为/小米/OPPO/VIVO 需在各自安全中心单独设置",
                ],
              },
              {
                icon: <Bell className="w-5 h-5" />,
                title: "关闭省电模式",
                items: [
                  "确保手机未开启「省电模式」或「超级省电」",
                  "省电模式会限制后台应用活动，导致断线",
                  "建议保持手机充电或电量充足",
                ],
              },
              {
                icon: <Wifi className="w-5 h-5" />,
                title: "保持网络畅通",
                items: [
                  "确保手机连接稳定的 WiFi 或移动数据",
                  "关闭 WiFi 休眠（设置 → WiFi → 高级 → 休眠策略 → 永不）",
                  "APP 支持 WiFi/4G 自动切换重连",
                ],
              },
              {
                icon: <Settings className="w-5 h-5" />,
                title: "锁定后台（重要）",
                items: [
                  "在最近任务列表中，下拉「飞鸽传书」卡片锁定",
                  "或点击应用卡片上的「锁」图标",
                  "防止系统清理后台时误杀 APP",
                ],
              },
              {
                icon: <Smartphone className="w-5 h-5" />,
                title: "各品牌特殊设置",
                items: [
                  "华为：手机管家 → 应用启动管理 → 飞鸽传书 → 手动管理（全部开启）",
                  "小米：设置 → 应用 → 飞鸽传书 → 省电策略 → 无限制",
                  "OPPO/VIVO：设置 → 电池 → 后台耗电管理 → 允许后台运行",
                ],
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="group p-5 bg-card/50 border border-foreground/5 hover:border-gold/20 transition-all duration-500 h-full relative overflow-hidden">
                  {/* 悬停时的墨迹效果 */}
                  <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-gold/0 group-hover:bg-gold/5 transition-all duration-700 group-hover:w-32 group-hover:h-32" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-gold/70 group-hover:text-gold transition-colors duration-300">{item.icon}</span>
                      <h3 className="text-sm font-serif tracking-[0.1em] text-foreground">{item.title}</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {item.items.map((text, j) => (
                        <li key={j} className="text-xs font-body text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-foreground/20 flex-shrink-0 mt-0.5">·</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 联系我们 ═══ */}
      <section id="contact" className="relative py-24 px-4 bg-card/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <span className="text-xs font-body text-vermilion tracking-[0.3em] uppercase">联系我们</span>
            <h2 className="text-3xl font-display tracking-[0.15em] text-foreground mt-3 mb-3">
              <BrushTitle text="江湖有缘" />
            </h2>
            <div className="w-12 h-px bg-foreground/20 mx-auto mb-8" />
            <p className="text-sm font-body text-muted-foreground leading-relaxed mb-10">
              如需购买设备配额、技术支持或商务合作，<br />
              欢迎通过 Telegram 联系我们，随时在线。
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <a
              href={TG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 hover:border-[#229ED9]/50 transition-all duration-300 group"
            >
              <svg className="w-5 h-5 text-[#229ED9] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.442-.751-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              <div className="text-left">
                <span className="block text-sm font-serif tracking-wider text-[#229ED9]">Telegram 联系</span>
                <span className="block text-xs font-body text-[#229ED9]/60">@byfc888</span>
              </div>
            </a>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-8 flex items-center justify-center gap-6 text-xs font-body text-muted-foreground/40">
              <span>7×24 在线</span>
              <span className="w-1 h-1 rounded-full bg-foreground/10" />
              <span>快速响应</span>
              <span className="w-1 h-1 rounded-full bg-foreground/10" />
              <span>专业服务</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 底部 ═══ */}
      <footer className="relative py-8 px-4 border-t border-foreground/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-serif tracking-[0.15em] text-foreground/60">飞鸽传书</span>
            <span className="text-xs font-body text-muted-foreground/30">短信远程控制系统</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-body text-muted-foreground/30">
            <a href={APK_DOWNLOAD_URL} download className="hover:text-foreground/60 transition-colors">下载 APK</a>
            <button onClick={() => setLocation("/login")} className="hover:text-foreground/60 transition-colors">登录</button>
            <a href={TG_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground/60 transition-colors">Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
