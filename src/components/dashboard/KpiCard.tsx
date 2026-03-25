import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: string;
}

export default function KpiCard({ title, value, subtitle, icon: Icon, trend, color }: KpiCardProps) {
  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "text-xs font-medium",
              trend.positive ? "text-status-certified" : "text-status-pending"
            )}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}% vs. mês anterior
            </p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          color || "bg-primary/10"
        )}>
          <Icon className={cn("w-6 h-6", color ? "text-card-foreground" : "text-primary")} />
        </div>
      </div>
    </div>
  );
}
