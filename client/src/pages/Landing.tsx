import { Download, Shield, Zap, Smartphone, MessageSquare, Users, ChevronDown, Send, Settings, BatteryCharging, Wifi, Bell, Image, BarChart3, Lock, RefreshCw, UserCheck, Layers, Clock, CheckCircle2, ChevronRight, HelpCircle, Minus, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import InkCanvas from "@/components/InkCanvas";

const INK_MOUNTAIN_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663393087442/4rTHqCojuh9Vnb7GsHmjrf/ink-mountain-bg2_dffcde5e.jpg";
const APK_DOWNLOAD_URL = "https://fgmessage.cc/feige-v2.3.0.apk";
const TG_URL = "https://t.me/byfc888";

// ─── 滚动渐入 Hook ───
function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// ─── 滚动渐入包装组件 ───
function Reveal({ children, delay = 0, className = "", direction = "up" }: {
  children: React.ReactNode; delay?: number; className?: string;
  direction?: "up" | "left" | "right" | "scale";
}) {
  const { ref, isVisible } = useScrollReveal();
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    scale: "scale(0.9)",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ─── 毛笔书写效果标题 ───
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

// ─── 数字滚动动画 ───
function AnimatedNumber({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useScrollReveal();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── FAQ 折叠组件 ───
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-foreground/5 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-serif tracking-wide text-foreground group-hover:text-vermilion transition-colors pr-4">{q}</span>
        <span className="flex-shrink-0 text-muted-foreground/50 group-hover:text-vermilion transition-colors">
          {open ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-500 ease-in-out"
        style={{ maxHeight: open ? "300px" : "0", opacity: open ? 1 : 0 }}
      >
        <p className="text-sm font-body text-muted-foreground leading-relaxed pb-5 pl-1 whitespace-pre-line">{a}</p>
      </div>
    </div>
  );
}

// ─── 章节标题组件 ───
function SectionHeader({ tag, tagColor = "text-vermilion", title, subtitle }: {
  tag: string; tagColor?: string; title: string; subtitle?: string;
}) {
  return (
    <Reveal className="text-center mb-16">
      <span className={`text-xs font-body ${tagColor} tracking-[0.3em] uppercase`}>{tag}</span>
      <h2 className="text-3xl sm:text-4xl font-display tracking-[0.15em] text-foreground mt-3 mb-3">
        <BrushTitle text={title} />
      </h2>
      <div className="w-16 h-px bg-foreground/20 mx-auto" />
      {subtitle && (
        <p className="text-sm font-body text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </Reveal>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [navSolid, setNavSolid] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const navItems = [
    { label: "功能", id: "features" },
    { label: "亮点", id: "highlights" },
    { label: "流程", id: "guide" },
    { label: "设置", id: "settings" },
    { label: "问答", id: "faq" },
    { label: "联系", id: "contact" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <InkCanvas />

      {/* ═══════════ 导航栏 ═══════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          backgroundColor: navSolid ? "rgba(15, 15, 18, 0.95)" : "transparent",
          borderBottom: navSolid ? "1px solid rgba(200,195,185,0.08)" : "1px solid transparent",
          backdropFilter: navSolid ? "blur(16px)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-serif tracking-[0.2em] text-foreground">飞鸽传书</span>
            <div className="hidden sm:block w-px h-4 bg-foreground/15" />
            <span className="hidden sm:block text-xs font-body text-muted-foreground">短信远程控制系统</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors">{item.label}</button>
            ))}
            <button
              onClick={() => setLocation("/login")}
              className="text-xs font-serif tracking-wider px-4 py-1.5 border border-foreground/20 text-foreground hover:bg-foreground/10 transition-all hover:border-foreground/40"
            >
              登录系统
            </button>
          </div>
          {/* 移动端菜单按钮 */}
          <button className="md:hidden text-foreground/70" onClick={() => setMobileMenu(!mobileMenu)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenu
                ? <path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
        {/* 移动端下拉菜单 */}
        {mobileMenu && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-foreground/5 px-4 py-4 space-y-3">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="block w-full text-left text-sm font-body text-muted-foreground hover:text-foreground py-1">{item.label}</button>
            ))}
            <button onClick={() => { setMobileMenu(false); setLocation("/login"); }} className="block w-full text-left text-sm font-serif text-vermilion py-1">登录系统</button>
          </div>
        )}
      </nav>

      {/* ═══════════ 首屏 Hero ═══════════ */}
      <section className="relative min-h-screen flex items-center justify-center pt-14">
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
          <div className="absolute top-20 left-6 w-12 h-px bg-foreground/8 animate-[brush-stroke_1.5s_ease-out]" />
          <div className="absolute top-20 left-6 w-px h-12 bg-foreground/8 animate-[brush-stroke-v_1.5s_ease-out]" />
          <div className="absolute bottom-6 right-6 w-12 h-px bg-foreground/8 animate-[brush-stroke_1.5s_ease-out_0.5s_both]" />
          <div className="absolute bottom-6 right-6 w-px h-12 bg-foreground/8 animate-[brush-stroke-v_1.5s_ease-out_0.5s_both]" />
        </div>

        <div className="relative text-center px-4 max-w-3xl mx-auto z-10">
          <div className="inline-block mb-8 animate-[seal-stamp_0.6s_ease-out_0.3s_both]">
            <span className="text-vermilion border-2 border-vermilion px-3 py-1 font-display text-sm tracking-widest" style={{ transform: "rotate(-3deg)", display: "inline-block" }}>
              飞鸽
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display tracking-[0.15em] text-foreground mb-4 leading-tight animate-[ink-fade_1s_ease-out_0.5s_both]">
            飞鸽传书
          </h1>
          <div className="w-20 h-px bg-foreground/20 mx-auto mb-4 animate-[brush-stroke_1.2s_ease-out_0.8s_both]" />
          <p className="text-lg sm:text-2xl font-serif text-foreground/70 tracking-[0.1em] mb-2 animate-[ink-fade_1s_ease-out_1s_both]">
            千里传音，一指掌控
          </p>
          <p className="text-sm sm:text-base font-body text-muted-foreground max-w-lg mx-auto mb-12 leading-relaxed animate-[ink-fade_1s_ease-out_1.2s_both]">
            一台电脑管控多台手机短信收发，实时同步、智能群发、团队协作。<br className="hidden sm:block" />
            江湖虽远，飞鸽可达。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-[ink-fade_1s_ease-out_1.4s_both]">
            <a
              href={APK_DOWNLOAD_URL}
              className="group flex items-center gap-3 px-8 py-4 bg-vermilion/10 border border-vermilion/30 hover:bg-vermilion/20 hover:border-vermilion/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(180,80,50,0.15)]"
            >
              <Download className="w-5 h-5 text-vermilion group-hover:animate-bounce" />
              <div className="text-left">
                <span className="block text-sm font-serif tracking-wider text-foreground">下载 Android 客户端</span>
                <span className="block text-xs font-body text-muted-foreground">v2.3.0 · 免费使用</span>
              </div>
            </a>
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center gap-2 px-8 py-4 border border-foreground/10 hover:border-foreground/25 transition-all text-sm font-serif tracking-wider text-foreground/70 hover:text-foreground"
            >
              进入控制台
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => scrollToSection("features")} className="animate-bounce text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors">
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* ═══════════ 数据统计条 ═══════════ */}
      <section className="relative py-12 px-4 border-y border-foreground/5 bg-card/30">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: 30, suffix: "+", label: "支持设备数" },
            { value: 100, suffix: "ms", label: "消息延迟" },
            { value: 24, suffix: "h", label: "全天候在线" },
            { value: 99, suffix: "%", label: "连接稳定率" },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.1} className="text-center">
              <div className="text-3xl sm:text-4xl font-display text-vermilion tracking-wider">
                <AnimatedNumber target={item.value} suffix={item.suffix} />
              </div>
              <div className="text-xs font-body text-muted-foreground mt-2 tracking-wider">{item.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ 核心功能 ═══════════ */}
      <section id="features" className="relative py-28 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <SectionHeader tag="核心功能" title="六大利器" subtitle="从短信收发到团队管理，飞鸽传书为您提供一站式解决方案" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Smartphone className="w-6 h-6" />, title: "多机管控", desc: "一个账号同时管理多台手机，每台设备独立会话，互不干扰。支持几台到上百台设备自由扩展，所有设备状态一目了然。" },
              { icon: <MessageSquare className="w-6 h-6" />, title: "实时收发", desc: "手机收到短信毫秒级推送到电脑，电脑发送指令实时下达手机。新消息即时弹窗通知，未读气泡醒目提醒，不漏一条消息。" },
              { icon: <Zap className="w-6 h-6" />, title: "智能群发", desc: "内置群发任务引擎，支持模板变量替换、轮流/随机模式、自定义间隔。CSV 批量导入联系人，实时进度监控，可暂停可恢复。" },
              { icon: <Shield className="w-6 h-6" />, title: "安全可靠", desc: "全链路加密传输，多层消息去重机制。团队数据严格隔离，主管与信使分级管理，确保数据安全与隐私保护。" },
              { icon: <Users className="w-6 h-6" />, title: "团队协作", desc: "主管负责团队管理和监控，信使专注短信收发。灵活的配额分配、聊天记录查看、统计报表，让团队协作井然有序。" },
              { icon: <BatteryCharging className="w-6 h-6" />, title: "永不断线", desc: "前台服务 + WakeLock + 心跳保活 + 网络切换自动重连 + 开机自启。多重保活策略确保 7×24 小时稳定在线。" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="group p-6 bg-card/50 border border-foreground/5 hover:border-vermilion/20 transition-all duration-500 relative h-full hover:bg-card/80 hover:shadow-[0_4px_30px_rgba(0,0,0,0.15)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-foreground/10 group-hover:border-vermilion/40 group-hover:w-6 group-hover:h-6 transition-all duration-500" />
                  <div className="absolute bottom-0 right-0 w-0 h-0 border-b border-r border-transparent group-hover:border-vermilion/20 group-hover:w-4 group-hover:h-4 transition-all duration-500" />
                  <div className="text-vermilion/70 mb-4 group-hover:text-vermilion transition-colors duration-300 group-hover:scale-110 transform origin-left">{item.icon}</div>
                  <h3 className="text-base font-serif tracking-[0.1em] text-foreground mb-3">{item.title}</h3>
                  <p className="text-sm font-body text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 功能亮点详解 ═══════════ */}
      <section id="highlights" className="relative py-28 px-4 bg-card/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <SectionHeader tag="功能亮点" tagColor="text-jade" title="十大亮点" subtitle="每一项功能都经过精心打磨，只为给您带来极致的使用体验" />

          {/* 亮点卡片 - 交替左右布局 */}
          <div className="space-y-12">
            {[
              {
                icon: <RefreshCw className="w-7 h-7" />,
                title: "实时双向同步",
                desc: "手机收到短信，电脑毫秒级收到通知；电脑发出短信，手机立即执行发送并写入系统短信数据库。手机端本地发送的短信也会同步到电脑端。首次连接自动同步手机所有历史短信，也可随时手动触发重新同步。无论短信从哪个方向产生，两端始终保持一致。",
                color: "vermilion",
              },
              {
                icon: <Image className="w-7 h-7" />,
                title: "图片与彩信",
                desc: "不仅支持文字短信，还支持图片/彩信（MMS）收发。电脑端选择图片发送，手机通过 MMS 协议发出；手机收到的彩信图片自动上传，在电脑端以缩略图展示，点击可放大预览原图。手机端聊天界面也支持直接选择图片发送。",
                color: "jade",
              },
              {
                icon: <Layers className="w-7 h-7" />,
                title: "智能群发引擎",
                desc: "短信模板支持 {姓名} 变量，群发时自动替换为每位联系人的真实姓名。支持轮流或随机使用多个模板，自定义发送间隔（5秒~1小时），模拟人工发送节奏。CSV 批量导入联系人，实时进度监控，支持暂停、恢复和取消。",
                color: "gold",
              },
              {
                icon: <Bell className="w-7 h-7" />,
                title: "新消息实时通知",
                desc: "任何一台手机收到新短信，电脑控制台立即弹出右下角通知窗口，显示发件人号码和内容摘要。点击通知直接跳转到对应设备的聊天界面。侧边栏和设备列表同步显示红色未读气泡，确保不遗漏任何重要消息。",
                color: "vermilion",
              },
              {
                icon: <UserCheck className="w-7 h-7" />,
                title: "联系人智能管理",
                desc: "联系人自动按「已回复」和「未回复」分组显示，一眼区分客户状态。重要联系人可置顶（无数量限制），置顶联系人在各自分组内排最前。支持快速搜索、未读标记、直接输入新号码发起对话，操作流畅高效。",
                color: "jade",
              },
              {
                icon: <Lock className="w-7 h-7" />,
                title: "消息防重复机制",
                desc: "内置多层去重保障：接收端 30 秒窗口去重，同设备同号码同内容只入库一次；发送端 10 秒去重，防止网络抖动导致重复发送；历史同步自动跳过已有消息。三重保险，杜绝重复。",
                color: "gold",
              },
              {
                icon: <BatteryCharging className="w-7 h-7" />,
                title: "永不断线保活",
                desc: "手机端采用前台服务常驻通知、WakeLock 唤醒锁、定时心跳包、网络切换自动重连、开机自启动等多重保活策略。断线后自动刷新补全遗漏消息。7×24 小时稳定在线，无需人工干预。",
                color: "vermilion",
              },
              {
                icon: <Users className="w-7 h-7" />,
                title: "团队权限隔离",
                desc: "每个团队拥有独立数据空间，主管只能管理自己团队内的信使和设备。信使只能操作自己的设备，无法访问管理功能。不同团队之间用户、设备、短信数据完全隔离，互不可见，确保数据安全。",
                color: "jade",
              },
              {
                icon: <BarChart3 className="w-7 h-7" />,
                title: "统计报表与导出",
                desc: "内置统计功能，按设备和日期范围查看已发送数量、单条回复数、多条回复数。主管可查看团队整体统计。号码导出功能支持按日期和方向筛选，一键导出 CSV 文件，方便数据分析和客户管理。",
                color: "gold",
              },
              {
                icon: <RefreshCw className="w-7 h-7" />,
                title: "APP 自动更新",
                desc: "手机端内置自动版本检测，服务器发布新版本时 APP 自动提示下载更新。安装后自动重连服务器，全程无需手动操作，始终保持最新版本。",
                color: "vermilion",
              },
            ].map((item, i) => (
              <Reveal key={i} delay={0.1} direction={i % 2 === 0 ? "left" : "right"}>
                <div className={`group flex flex-col md:flex-row items-start gap-6 p-6 sm:p-8 border border-foreground/5 hover:border-${item.color}/20 transition-all duration-500 bg-background/50 hover:bg-card/50 relative overflow-hidden`}>
                  {/* 装饰光晕 */}
                  <div className={`absolute -top-20 ${i % 2 === 0 ? '-right-20' : '-left-20'} w-40 h-40 rounded-full bg-${item.color}/0 group-hover:bg-${item.color}/5 transition-all duration-700`} />
                  
                  <div className="relative flex-shrink-0">
                    <div className={`w-14 h-14 flex items-center justify-center border border-${item.color}/20 text-${item.color}/70 group-hover:text-${item.color} group-hover:border-${item.color}/40 transition-all duration-300`}>
                      {item.icon}
                    </div>
                    <span className="absolute -top-2 -right-2 text-xs font-display text-foreground/15">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  
                  <div className="relative flex-1">
                    <h3 className="text-lg font-serif tracking-[0.1em] text-foreground mb-3">{item.title}</h3>
                    <p className="text-sm font-body text-muted-foreground leading-[1.8]">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 使用流程 ═══════════ */}
      <section id="guide" className="relative py-28 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-4xl mx-auto">
          <SectionHeader tag="快速上手" tagColor="text-gold" title="四步入门" subtitle="从下载到使用，只需 5 分钟即可完成全部配置" />

          {/* 时间线样式 */}
          <div className="relative">
            {/* 中轴线 */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-foreground/10 via-foreground/10 to-transparent md:-translate-x-px" />

            {[
              {
                step: "壹", num: "01",
                title: "下载安装",
                desc: "在需要被控制的 Android 手机上，访问系统首页点击\u300C下载 Android 客户端\u300D按钮下载 APK。安装时如提示\u201C未知来源\u201D，请在手机设置中允许安装。安装完成后打开飞鸽传书 APP。",
                icon: <Download className="w-5 h-5" />,
                tips: "支持 Android 7.0 及以上版本",
              },
              {
                step: "贰", num: "02",
                title: "授予权限",
                desc: "首次打开 APP 后，请依次授予短信读取、短信发送、通知等权限。强烈建议将飞鸽传书设为默认短信应用，这样可以完整接管短信收发，支持彩信和图片功能。",
                icon: <Shield className="w-5 h-5" />,
                tips: "设为默认短信应用后支持彩信",
              },
              {
                step: "叁", num: "03",
                title: "扫码配对",
                desc: "在电脑端登录控制台，进入「信使」页面，点击「添加设备」生成配对二维码。打开手机 APP 点击「扫码配对」扫描二维码即可完成绑定。无法扫码时也可手动输入配对令牌。",
                icon: <Smartphone className="w-5 h-5" />,
                tips: "二维码有效期 10 分钟",
              },
              {
                step: "肆", num: "04",
                title: "开始使用",
                desc: "配对成功后，手机上所有历史短信自动同步到电脑。之后每条新短信实时推送，您可以在电脑端查看、回复、群发短信。手机端本地发送的短信也会同步到电脑，实现完全双向同步。",
                icon: <Send className="w-5 h-5" />,
                tips: "历史短信自动同步，也可手动触发",
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.12} direction={i % 2 === 0 ? "left" : "right"}>
                <div className={`relative flex flex-col md:flex-row items-start gap-6 mb-12 last:mb-0 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  {/* 时间线节点 */}
                  <div className="absolute left-6 md:left-1/2 w-3 h-3 bg-vermilion/60 border-2 border-background -translate-x-1.5 md:-translate-x-1.5 mt-6 z-10" style={{ borderRadius: '1px' }} />

                  {/* 内容卡片 */}
                  <div className={`flex-1 ml-14 md:ml-0 ${i % 2 === 0 ? 'md:pr-12' : 'md:pl-12'}`}>
                    <div className="group p-6 bg-card/50 border border-foreground/5 hover:border-gold/20 transition-all duration-500 relative">
                      <div className="absolute top-3 right-4 text-xs font-display text-foreground/10">{item.num}</div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 flex items-center justify-center border border-vermilion/20 text-vermilion/80">
                          <span className="text-lg font-display">{item.step}</span>
                        </div>
                        <div>
                          <h3 className="text-base font-serif tracking-[0.1em] text-foreground">{item.title}</h3>
                        </div>
                      </div>
                      <p className="text-sm font-body text-muted-foreground leading-[1.8] mb-3">{item.desc}</p>
                      <div className="flex items-center gap-2 text-xs font-body text-gold/70">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{item.tips}</span>
                      </div>
                    </div>
                  </div>

                  {/* 占位 */}
                  <div className="hidden md:block flex-1" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 角色说明 ═══════════ */}
      <section className="relative py-28 px-4 bg-card/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <SectionHeader tag="角色分工" tagColor="text-gold" title="主管与信使" subtitle="两级管理架构，各司其职，高效协作" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 主管卡片 */}
            <Reveal direction="left">
              <div className="group p-8 border border-foreground/5 hover:border-gold/20 transition-all duration-500 bg-background/50 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/0 group-hover:bg-gold/5 rounded-full -translate-y-12 translate-x-12 transition-all duration-700" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 flex items-center justify-center border border-gold/30 text-gold">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif tracking-[0.1em] text-foreground">主管</h3>
                      <p className="text-xs font-body text-muted-foreground">团队管理者</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "管理名下信使账号（添加、编辑、禁用、重置密码）",
                      "为每位信使分配设备连接配额",
                      "查看团队内所有信使的聊天记录",
                      "查看团队整体统计报表",
                      "导出团队所有收发号码",
                    ].map((text, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm font-body text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-gold/60 flex-shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* 信使卡片 */}
            <Reveal direction="right">
              <div className="group p-8 border border-foreground/5 hover:border-vermilion/20 transition-all duration-500 bg-background/50 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-24 h-24 bg-vermilion/0 group-hover:bg-vermilion/5 rounded-full -translate-y-12 translate-x-12 transition-all duration-700" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 flex items-center justify-center border border-vermilion/30 text-vermilion">
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif tracking-[0.1em] text-foreground">信使</h3>
                      <p className="text-xs font-body text-muted-foreground">一线操作员</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "管理自己的手机设备（配对、命名、同步）",
                      "查看和回复所有设备的短信消息",
                      "创建和执行群发任务",
                      "管理短信模板（支持变量占位符）",
                      "查看个人统计数据和导出号码",
                    ].map((text, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm font-body text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-vermilion/60 flex-shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="mt-8 p-5 border border-foreground/5 bg-card/30 flex items-start gap-3">
              <Lock className="w-5 h-5 text-jade/70 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-body text-muted-foreground leading-relaxed">
                <span className="text-foreground font-serif">权限隔离：</span>每个团队拥有独立数据空间，主管只能管理自己团队内的信使和设备，不同团队之间的数据完全隔离、互不可见。信使登录后只能看到自己的设备和短信，无法访问任何管理功能。
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ 手机端设置 ═══════════ */}
      <section id="settings" className="relative py-28 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-5xl mx-auto">
          <SectionHeader tag="重要提示" tagColor="text-gold" title="手机端设置" subtitle="为确保 APP 稳定运行、永不断线，请务必完成以下设置" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <BatteryCharging className="w-5 h-5" />,
                title: "关闭电池优化",
                items: [
                  "设置 → 电池 → 电池优化",
                  "找到「飞鸽传书」→ 选择「不优化」",
                  "或：设置 → 应用 → 飞鸽传书 → 电池 → 不受限制",
                ],
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: "允许自启动",
                items: [
                  "设置 → 应用 → 飞鸽传书 → 权限",
                  "开启「自启动」和「后台运行」",
                  "华为/小米/OPPO/VIVO 需在安全中心单独设置",
                ],
              },
              {
                icon: <Bell className="w-5 h-5" />,
                title: "关闭省电模式",
                items: [
                  "确保未开启「省电模式」或「超级省电」",
                  "省电模式会限制后台活动导致断线",
                  "建议保持手机充电或电量充足",
                ],
              },
              {
                icon: <Wifi className="w-5 h-5" />,
                title: "保持网络畅通",
                items: [
                  "确保连接稳定的 WiFi 或移动数据",
                  "关闭 WiFi 休眠（高级设置 → 永不）",
                  "APP 支持 WiFi/4G 自动切换重连",
                ],
              },
              {
                icon: <Settings className="w-5 h-5" />,
                title: "锁定后台",
                items: [
                  "在最近任务列表中下拉锁定飞鸽传书",
                  "或点击卡片上的「锁」图标",
                  "防止系统清理后台时误杀 APP",
                ],
              },
              {
                icon: <Smartphone className="w-5 h-5" />,
                title: "各品牌特殊设置",
                items: [
                  "华为：手机管家 → 应用启动管理 → 手动管理",
                  "小米：省电策略 → 无限制",
                  "OPPO/VIVO：后台耗电管理 → 允许后台运行",
                ],
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="group p-5 bg-card/50 border border-foreground/5 hover:border-gold/20 transition-all duration-500 h-full relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-gold/0 group-hover:bg-gold/5 transition-all duration-700 group-hover:w-32 group-hover:h-32" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-gold/70 group-hover:text-gold transition-colors duration-300">{item.icon}</span>
                      <h3 className="text-sm font-serif tracking-[0.1em] text-foreground">{item.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {item.items.map((text, j) => (
                        <li key={j} className="text-xs font-body text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-gold/30 flex-shrink-0 mt-0.5">·</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <div className="mt-8 p-5 border border-gold/15 bg-gold/5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-gold/70 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-body text-muted-foreground leading-relaxed">
                <span className="text-foreground font-serif">设置完成检查：</span>完成以上所有设置后，建议锁屏等待 10 分钟，然后从电脑端发送一条测试短信，确认手机能正常收到并执行发送。如果测试失败，请逐项检查上述设置。
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ 常见问题 ═══════════ */}
      <section id="faq" className="relative py-28 px-4 bg-card/20">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-3xl mx-auto">
          <SectionHeader tag="常见问题" tagColor="text-jade" title="疑问解答" subtitle="使用过程中遇到问题？这里也许有您需要的答案" />

          <Reveal>
            <div className="border border-foreground/5 bg-background/50 divide-y-0 px-6">
              {[
                { q: "手机显示\u201C连接断开\u201D怎么办？", a: "首先检查手机网络是否正常。如果网络正常，APP 会在几秒内自动重连。如果长时间无法重连，请尝试：\n1. 关闭 APP 后重新打开\n2. 检查是否开启了省电模式\n3. 检查电池优化设置\n4. 确认手机没有清理后台进程" },
                { q: "电脑端发送短信后手机没有发出去？", a: "请确认：\n1. 手机设备在控制台显示为\u201C在线\u201D状态\n2. 手机有足够的短信余额或套餐\n3. 手机信号正常\n4. 发送彩信需要手机有移动数据网络且已设为默认短信应用" },
                { q: "为什么有些短信没有同步到电脑？", a: "可能原因：\n1. 短信产生时手机与服务器断开了连接\u2014重连后点击\u300C同步\u300D按钮即可补全\n2. 飞鸽传书未被设为默认短信应用\u2014部分短信可能被原生应用拦截\n3. 手机权限未完整授予\u2014请检查短信读取权限" },
                { q: "配对二维码扫不了怎么办？", a: "二维码有效期为 10 分钟，过期需重新生成。如果摄像头无法识别，可以选择\u300C手动输入令牌\u300D方式：复制二维码下方的文字令牌，在手机 APP 中粘贴输入即可。" },
                { q: "信使忘记密码怎么办？", a: "请联系您的主管，主管可以在\u300C子后台\u300D中为您重置密码。" },
                { q: "一个账号可以管理多少台手机？", a: "设备数量由主管分配。主管可以根据团队需要，为每位信使分配不同数量的设备配额。如需增加配额，请联系主管调整。" },
                { q: "群发任务中途失败了怎么办？", a: "群发任务支持暂停和恢复功能。如果任务中途因网络等原因部分失败，您可以暂停任务排查问题后，从断点处继续发送，无需重新创建。" },
                { q: "如何发送图片/彩信？", a: "在聊天界面底部发送栏点击图片图标即可选择图片发送。前提条件：\n1. 飞鸽传书已设为手机的默认短信应用\n2. 手机有可用的移动数据网络\n电脑端和手机端都支持发送图片。" },
                { q: "系统支持哪些手机？", a: "飞鸽传书手机端支持 Android 7.0 及以上版本的所有 Android 手机。目前不支持 iPhone（iOS 系统限制，无法接管短信功能）。" },
                { q: "手机端 APP 耗电量大吗？", a: "飞鸽传书采用优化的保活策略，正常待机耗电量很低。但由于需要保持网络连接和前台服务，耗电量略高于普通应用。建议保持手机充电以获得最佳体验。" },
              ].map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ CTA 下载条 ═══════════ */}
      <section className="relative py-20 px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <div className="inline-block mb-6">
              <span className="text-vermilion border-2 border-vermilion px-3 py-1 font-display text-sm tracking-widest" style={{ transform: "rotate(-3deg)", display: "inline-block" }}>
                飞鸽
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display tracking-[0.15em] text-foreground mb-4">
              开始使用飞鸽传书
            </h2>
            <p className="text-sm font-body text-muted-foreground mb-10 max-w-md mx-auto">
              下载手机端 APP，5 分钟完成配对，即刻体验高效的短信远程管理。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={APK_DOWNLOAD_URL}
                className="group flex items-center gap-3 px-8 py-4 bg-vermilion/10 border border-vermilion/30 hover:bg-vermilion/20 hover:border-vermilion/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(180,80,50,0.15)]"
              >
                <Download className="w-5 h-5 text-vermilion group-hover:animate-bounce" />
                <div className="text-left">
                  <span className="block text-sm font-serif tracking-wider text-foreground">下载 Android 客户端</span>
                  <span className="block text-xs font-body text-muted-foreground">v2.3.0 · 免费使用</span>
                </div>
              </a>
              <button
                onClick={() => setLocation("/login")}
                className="flex items-center gap-2 px-8 py-4 border border-foreground/10 hover:border-foreground/25 transition-all text-sm font-serif tracking-wider text-foreground/70 hover:text-foreground"
              >
                进入控制台
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ 联系我们 ═══════════ */}
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

      {/* ═══════════ 底部 ═══════════ */}
      <footer className="relative py-10 px-4 border-t border-foreground/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-serif tracking-[0.15em] text-foreground/60">飞鸽传书</span>
              <span className="text-xs font-body text-muted-foreground/30">短信远程控制系统</span>
            </div>
            <div className="flex items-center gap-6 text-xs font-body text-muted-foreground/30">
              <a href={APK_DOWNLOAD_URL} className="hover:text-foreground/60 transition-colors">下载 APK</a>
              <button onClick={() => setLocation("/login")} className="hover:text-foreground/60 transition-colors">登录</button>
              <a href={TG_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground/60 transition-colors">Telegram</a>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs font-body text-muted-foreground/20">千里传音，一指掌控</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
