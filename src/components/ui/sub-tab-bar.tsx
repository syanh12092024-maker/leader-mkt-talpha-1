"use client";

import { cn } from "@/lib/utils";

interface SubTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface SubTabBarProps {
    tabs: SubTab[];
    active: string;
    onChange: (id: string) => void;
}

export function SubTabBar({ tabs, active, onChange }: SubTabBarProps) {
    return (
        <div className="flex gap-1 mb-6 p-1 bg-card rounded-lg border border-border/50 w-fit">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    className={cn(
                        "flex items-center gap-2 px-4 py-1.5 text-sm rounded-md transition-all",
                        active === t.id
                            ? "bg-indigo-500/20 text-indigo-400 font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-gray-50"
                    )}
                >
                    {t.icon}
                    {t.label}
                </button>
            ))}
        </div>
    );
}
