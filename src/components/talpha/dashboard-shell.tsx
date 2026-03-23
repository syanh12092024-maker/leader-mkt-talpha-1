"use client";

import { useState, useEffect } from "react";
import {
    Megaphone, Package, DollarSign,
    Users, Brain, Globe, Target,
    ArrowLeft, Search, FileText, Send, Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subDays } from "date-fns";
import DateRangePicker from "@/components/ui/date-range-picker";
import Link from "next/link";

import TALPHACeoOverviewTab from "./tabs/ceo-overview-tab";
import TALPHAAdsCommandTab from "./tabs/ads-command-tab";
import TALPHAMarketingTab from "./tabs/marketing-tab";
import TALPHAProductsTab from "./tabs/products-tab";
import TALPHAPnLTab from "./tabs/pnl-tab";
import TALPHACustomerTab from "./tabs/customer-tab";
import TALPHAMarketIntelTab from "./tabs/market-intel-tab";
import SpyBoardTab from "./tabs/spy-board-tab";
import ScriptGeneratorTab from "./tabs/script-generator-tab";
import BroadcastTab from "./tabs/broadcast-tab";
import VanDonTab from "./tabs/van-don-tab";

const TAB_ITEMS = [
    { id: "ceo", label: "Tổng quan CEO", icon: Brain },
    { id: "ads-command", label: "Trung tâm Quảng cáo", icon: Target },
    { id: "marketing", label: "Marketing & QC", icon: Megaphone },
    { id: "products", label: "Sản phẩm & Kho", icon: Package },
    { id: "pnl", label: "Lãi / Lỗ", icon: DollarSign },
    { id: "customers", label: "Khách hàng", icon: Users },
    { id: "market-intel", label: "Thị trường", icon: Globe },
    { id: "spy-board", label: "Tìm SP Spy", icon: Search },
    { id: "script-gen", label: "Tạo kịch bản", icon: FileText },
    { id: "broadcast", label: "Gửi tin hàng loạt", icon: Send },
    { id: "van-don", label: "Vận đơn", icon: Truck },
];

export default function TALPHADashboardShell() {
    const [activeTab, setActiveTab] = useState("ads-command");
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: subDays(new Date(), 59),
        to: new Date(),
    });

    useEffect(() => {
        document.cookie = "activeDataset=TALPHA_Dataset; path=/;";
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            {/* Sidebar — Premium Dark Theme */}
            <aside className="w-64 bg-gradient-to-b from-blue-950 via-blue-900 to-blue-950 flex flex-col shadow-2xl">
                <div className="flex flex-col p-5 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs group">
                            <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" /> Trang chủ
                        </Link>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white text-xs font-black">Tα</span>
                        </div>
                        <div>
                            <span className="text-base font-bold text-white tracking-tight">TALPHA</span>
                            <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold text-red-400 border border-red-500/20">Active</span>
                        </div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1.5 ml-[42px]">Tiểu Alpha — Middle East</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 ml-[42px]">🇸🇦 🇦🇪 🇰🇼 🇴🇲 🇶🇦 🇧🇭</span>
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
                    {TAB_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                                activeTab === item.id
                                    ? "bg-gradient-to-r from-blue-500/20 to-blue-400/10 text-white shadow-lg shadow-blue-500/5 border border-blue-400/20"
                                    : "text-blue-200/60 hover:bg-white/[0.05] hover:text-white"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4", activeTab === item.id ? "text-blue-300" : "")} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/[0.06]">
                    <div className="text-[10px] text-blue-400/60 font-semibold">V5.2 PREMIUM</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Hệ thống CEO Intelligence</div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
                <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200/60 bg-white/70 px-6 backdrop-blur-xl">
                    <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                        {TAB_ITEMS.find((t) => t.id === activeTab)?.label}
                    </h1>
                    {activeTab !== "ads-command" && (
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                    )}
                </header>

                <div className={cn("w-full", (activeTab === "script-gen" || activeTab === "broadcast") ? "p-3" : activeTab === "van-don" ? "p-4" : "p-6")}>
                    {activeTab === "ceo" && <TALPHACeoOverviewTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "ads-command" && <TALPHAAdsCommandTab />}
                    {activeTab === "marketing" && <TALPHAMarketingTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "products" && <TALPHAProductsTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "pnl" && <TALPHAPnLTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "customers" && <TALPHACustomerTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "market-intel" && <TALPHAMarketIntelTab dateRange={dateRange} projectId="TALPHA" />}
                    {activeTab === "spy-board" && <SpyBoardTab />}
                    {activeTab === "script-gen" && <ScriptGeneratorTab />}
                    {activeTab === "broadcast" && <BroadcastTab />}
                    {activeTab === "van-don" && <VanDonTab />}
                </div>
            </main>
        </div>
    );
}
