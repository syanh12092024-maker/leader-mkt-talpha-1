"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, Satellite, Megaphone, Package,
    BadgePercent, Users, Globe, ChevronLeft, Sparkles
} from "lucide-react";
import { cn } from "@/shared/utils";

const menuItems = [
    { name: "CEO Intelligence", icon: LayoutDashboard, href: "/talpha/ceo" },
    { name: "Ads Command Center", icon: Satellite, href: "/talpha/ads-command-center" },
    { name: "Marketing & Ads", icon: Megaphone, href: "/talpha/marketing" },
    { name: "Sản phẩm & Kho", icon: Package, href: "/talpha/products" },
    { name: "P&L", icon: BadgePercent, href: "/talpha/pnl" },
    { name: "Khách hàng", icon: Users, href: "/talpha/customers" },
    { name: "Market Intel", icon: Globe, href: "/talpha/market-intel" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden relative">
            <div className="p-6 border-b border-white/5">
                <Link href="/" className="flex flex-col gap-1 group">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-black text-xl tracking-tighter">TALPHA</span>
                        <div className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold">Active</div>
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        Tiểu Alpha — Middle East
                        <div className="flex gap-0.5">
                            {["🇸🇦", "🇦🇪", "🇰🇼", "🇴🇲", "🇶🇦", "🇧🇭"].map(f => <span key={f}>{f}</span>)}
                        </div>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 p-4 flex flex-col gap-2">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-xs text-muted-foreground hover:text-white transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Quay lại Trang chủ
                </Link>
                <div className="h-px bg-white/5 my-2" />
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                                isActive
                                    ? "bg-amber-500/10 text-amber-500 font-bold"
                                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-amber-500" : "group-hover:text-amber-400")} />
                            <span className="text-sm">{item.name}</span>
                            {isActive && (
                                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 border-t border-white/5">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                        <Sparkles className="w-3 h-3" /> V5.1 PREMIUM
                    </div>
                    <p className="text-[10px] text-muted-foreground">Hệ thống của bạn đang được vận hành bởi Antigravity.</p>
                </div>
            </div>
        </aside>
    );
}
