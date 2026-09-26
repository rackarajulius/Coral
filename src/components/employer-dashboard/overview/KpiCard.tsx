import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import AvatarGroupCount from "./AvatarGroupCount";
import _CountUpLib from "react-countup";
const CountUp = (_CountUpLib as any).default ?? _CountUpLib;

export interface KpiCardProps {
  icon: any;
  label: string;
  value: string;
  unit: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  accent: string;
  iconColor: string;
  avatars?: string[];
  avatarTotal?: number;
  ctaLabel?: string;
  to?: string;
}

const KpiCard = ({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  trend,
  accent,
  iconColor,
  avatars,
  avatarTotal,
  ctaLabel = "Open",
  to,
}: KpiCardProps) => (
  <div className="group relative bg-card rounded-xl border border-gray-300  hover:shadow-md transition-all duration-300">
    <div className={cn("h-1.5 w-full bg-gradient-to-r", accent.replace("/15", "").replace("/0", "/60"))} />
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        {avatars && avatars.length > 0 ? (
          <AvatarGroupCount avatars={avatars} total={avatarTotal ?? avatars.length} iconColor={iconColor} />
        ) : (
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br", accent)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full",
            trend === "down"
              ? "text-rose-600 bg-rose-500/10"
              : trend === "neutral"
                ? "text-muted-foreground bg-muted"
                : "text-emerald-600 bg-emerald-500/10"
          )}
        >
          {trend === "down" ? (
            <TrendingDown className="h-3 w-3" />
          ) : trend === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : null}
          {delta}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <CountUp
          end={parseFloat(String(value).replace(/,/g, ""))}
          duration={2}
            enableScrollSpy
            scrollSpyOnce
          separator=","
          decimals={String(value).includes(".") ? 1 : 0}
          suffix={String(value).replace(/,/g, "").replace(/^[\d.-]+/, "")}
          className="text-3xl font-bold text-foreground tracking-tight"
        />
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
      <p className="text-sm font-medium text-foreground mt-1">{label}</p>
      {to ? (
        <Link
          to={to}
          className="mt-4 w-full inline-flex items-center justify-between text-xs font-medium text-orange-500 hover:gap-2 transition-all"
          aria-label={`Open ${label}`}
        >
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <button
          className="mt-4 w-full inline-flex items-center justify-between text-xs font-medium text-orange-500 hover:gap-2 transition-all"
          aria-label={`Open ${label}`}
        >
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  </div>
);

export default KpiCard;
