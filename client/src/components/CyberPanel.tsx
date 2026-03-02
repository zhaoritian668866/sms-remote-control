import { cn } from "@/lib/utils";

interface InkPanelProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CyberPanel({
  title,
  subtitle,
  children,
  className,
  noPadding = false,
}: InkPanelProps) {
  return (
    <div
      className={cn(
        "relative bg-card/80 backdrop-blur-sm border border-foreground/10",
        className
      )}
    >
      {/* 顶部墨线 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

      {/* 四角装饰 */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-foreground/30" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-foreground/30" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-foreground/30" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-foreground/30" />

      {/* 标题 */}
      {title && (
        <div className="px-4 pt-3 pb-2 border-b border-foreground/10">
          <h3 className="font-serif text-sm font-medium tracking-wider text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-body mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* 内容 */}
      <div className={noPadding ? "" : "p-4"}>
        {children}
      </div>
    </div>
  );
}

export function CyberStatusDot({ online }: { online: boolean }) {
  return (
    <div className="relative flex items-center">
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          online ? "bg-jade" : "bg-muted-foreground/40"
        )}
      />
      {online && (
        <div className="absolute w-2 h-2 rounded-full bg-jade animate-ping opacity-50" />
      )}
    </div>
  );
}

export function CyberStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="relative bg-card/60 border border-foreground/10 p-4">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-foreground/20" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-foreground/20" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-foreground/20" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-foreground/20" />

      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-xs font-body text-muted-foreground tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-serif font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}
