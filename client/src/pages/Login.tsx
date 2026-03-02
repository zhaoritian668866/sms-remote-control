import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirect = new URLSearchParams(search).get("redirect") || "/";
  const utils = trpc.useUtils();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("登录成功");
      setTimeout(() => {
        window.location.href = redirect;
      }, 300);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("注册成功，已自动登录");
      setTimeout(() => {
        window.location.href = redirect;
      }, 300);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("请填写完整信息");
      return;
    }
    if (isRegister) {
      if (!name.trim()) {
        toast.error("请填写昵称");
        return;
      }
      if (password.length < 6) {
        toast.error("密码至少6位");
        return;
      }
      registerMutation.mutate({ username: username.trim(), password, name: name.trim() });
    } else {
      loginMutation.mutate({ username: username.trim(), password });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* 水墨背景装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 opacity-[0.03]"
          style={{
            background: "radial-gradient(ellipse at center, currentColor 0%, transparent 70%)",
          }}
        />
        <div className="absolute bottom-0 right-0 w-96 h-96 opacity-[0.02]"
          style={{
            background: "radial-gradient(ellipse at center, currentColor 0%, transparent 70%)",
          }}
        />
        {/* 细线装饰 */}
        <div className="absolute top-8 left-8 w-16 h-px bg-foreground/10" />
        <div className="absolute top-8 left-8 w-px h-16 bg-foreground/10" />
        <div className="absolute bottom-8 right-8 w-16 h-px bg-foreground/10" />
        <div className="absolute bottom-8 right-8 w-px h-16 bg-foreground/10" />
      </div>

      {/* 登录卡片 */}
      <div className="relative w-full max-w-sm mx-4">
        {/* 四角墨线 */}
        <div className="absolute -top-3 -left-3 w-6 h-6 border-t border-l border-foreground/20" />
        <div className="absolute -top-3 -right-3 w-6 h-6 border-t border-r border-foreground/20" />
        <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b border-l border-foreground/20" />
        <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b border-r border-foreground/20" />

        <div className="bg-card/80 border border-foreground/10 backdrop-blur-sm p-8">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-serif text-foreground tracking-[0.3em] mb-2">
              飞鸽传书
            </h1>
            <div className="w-12 h-px bg-foreground/20 mx-auto mb-3" />
            <p className="text-xs font-body text-muted-foreground tracking-wider">
              短信远程控制系统
            </p>
          </div>

          {/* 切换标签 */}
          <div className="flex mb-6 border-b border-foreground/10">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 pb-2 text-sm font-serif tracking-wider transition-colors relative ${
                !isRegister ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              登录
              {!isRegister && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-foreground/60" />
              )}
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 pb-2 text-sm font-serif tracking-wider transition-colors relative ${
                isRegister ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              注册
              {isRegister && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-foreground/60" />
              )}
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-body text-muted-foreground mb-1.5 tracking-wider">
                  昵称
                </label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入昵称"
                  className="h-10 bg-background/60 border-foreground/10 text-foreground font-body text-sm focus:border-foreground/30"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-body text-muted-foreground mb-1.5 tracking-wider">
                用户名
              </label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入用户名"
                className="h-10 bg-background/60 border-foreground/10 text-foreground font-body text-sm focus:border-foreground/30"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-body text-muted-foreground mb-1.5 tracking-wider">
                密码
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRegister ? "至少6位密码" : "输入密码"}
                  className="h-10 bg-background/60 border-foreground/10 text-foreground font-body text-sm pr-10 focus:border-foreground/30"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-10 bg-foreground/10 border border-foreground/20 text-foreground hover:bg-foreground/20 font-serif tracking-[0.2em] text-sm mt-6"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRegister ? (
                "注册"
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 底部提示 */}
          <div className="mt-6 text-center">
            <p className="text-xs font-body text-muted-foreground/40">
              {isRegister ? "已有账号？" : "没有账号？"}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-foreground/60 hover:text-foreground ml-1 underline underline-offset-4 transition-colors"
              >
                {isRegister ? "去登录" : "去注册"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
