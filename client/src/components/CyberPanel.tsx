import { cn } from "@/lib/utils";

interface CyberPanelProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  accentColor?: "cyan" | "pink" | "purple";
  noPadding?: boolean;
}

const accentColors = {
  cyan: {
    border: "border-neon-cyan/20",
    cornerBorder: "border-neon-cyan",
    title: "text-neon-cyan",
    glow: "neon-glow-cyan",
    line: "from-transparent via-neon-cyan to-transparent",
    topLine: "bg-neon-cyan/60",
  },
  pink: {
    border: "border-neon-pink/20",
    cornerBorder: "border-neon-pink",
    title: "text-neon-pink",
    glow: "neon-glow-pink",
    line: "from-transparent via-neon-pink to-transparent",
    topLine: "bg-neon-pink/60",
  },
  purple: {
    border: "border-neon-purple/20",
    cornerBorder: "border-neon-purple",
    title: "text-neon-purple",
    glow: "",
    line: "from-transparent via-neon-purple to-transparent",
    topLine: "bg-neon-purple/60",
  },
};

export function CyberPanel({
  title,
  subtitle,
  children,
  className,
  accentColor = "cyan",
  noPadding = false,
}: CyberPanelProps) {
  const colors = accentColors[accentColor];

  return (
    <div
      className={cn(
        "relative bg-card/80 backdrop-blur-sm",
        colors.border,
        "border",
        className
      )}
    >
      {/* Top line */}
      <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r", colors.line)} />

      {/* Corner brackets */}
      <div className={cn("absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2", colors.cornerBorder)} />
      <div className={cn("absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2", colors.cornerBorder)} />
      <div className={cn("absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2", colors.cornerBorder)} />
      <div className={cn("absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2", colors.cornerBorder)} />

      {/* Header */}
      {title && (
        <div className="px-4 pt-3 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse-neon", accentColor === "cyan" ? "bg-neon-cyan" : accentColor === "pink" ? "bg-neon-pink" : "bg-neon-purple")} />
            <h3 className={cn("font-display text-sm font-bold tracking-wider uppercase", colors.title, colors.glow)}>
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-mono mt-1 pl-3.5">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Content */}
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
          online ? "bg-neon-green" : "bg-destructive"
        )}
      />
      {online && (
        <div className="absolute w-2 h-2 rounded-full bg-neon-green animate-ping opacity-75" />
      )}
    </div>
  );
}

export function CyberStatCard({
  label,
  value,
  icon,
  accentColor = "cyan",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: "cyan" | "pink" | "purple";
}) {
  const colors = accentColors[accentColor];

  return (
    <div className={cn("relative bg-card/60 border p-4", colors.border)}>
      <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", colors.cornerBorder)} />
      <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", colors.cornerBorder)} />
      <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", colors.cornerBorder)} />
      <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", colors.cornerBorder)} />

      <div className="flex items-center gap-2 mb-2">
        {icon && <span className={colors.title}>{icon}</span>}
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-2xl font-display font-bold", colors.title, colors.glow)}>
        {value}
      </div>
    </div>
  );
}
