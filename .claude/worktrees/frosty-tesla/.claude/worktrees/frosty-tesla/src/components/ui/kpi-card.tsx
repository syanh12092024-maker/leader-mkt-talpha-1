import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    title: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: {
        value: number;
        label?: string;
    };
    subValue?: string;
    className?: string;
    status?: "success" | "warning" | "danger" | "neutral";
}

export function KPICard({
    title,
    value,
    icon: Icon,
    trend,
    subValue,
    className,
    status = "neutral",
}: KPICardProps) {
    const accentMap = {
        success: "border-l-blue-500",
        warning: "border-l-blue-300",
        danger: "border-l-red-500",
        neutral: "border-l-slate-300",
    };

    const iconColorMap = {
        success: "text-blue-500",
        warning: "text-blue-400",
        danger: "text-red-500",
        neutral: "text-slate-400",
    };

    return (
        <div className={cn("kpi-card flex flex-col justify-between border-l-[3px]", accentMap[status], className)}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
                {Icon && <Icon className={cn("h-4 w-4", iconColorMap[status])} />}
            </div>
            <div className="mt-2 space-y-1">
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
                    {trend && (
                        <span
                            className={cn(
                                "mb-1 text-xs font-semibold",
                                trend.value > 0 ? "text-blue-500" : "text-red-500"
                            )}
                        >
                            {trend.value > 0 ? "+" : ""}
                            {trend.value}%
                        </span>
                    )}
                </div>
                {subValue && <p className="text-[11px] text-slate-400 font-medium">{subValue}</p>}
            </div>
        </div>
    );
}
