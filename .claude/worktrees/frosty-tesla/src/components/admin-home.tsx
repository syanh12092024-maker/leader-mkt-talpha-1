"use client";

import Link from "next/link";
import { ArrowRight, Globe, TrendingUp, Package, Users, Zap, Settings, BarChart3, Layers } from "lucide-react";

const PROJECTS = [
    {
        id: "STRAMARK",
        name: "STRAMARK",
        subtitle: "Aurelia Wear — Romania",
        route: "/stramark",
        status: "Pilot",
        statusBg: "bg-amber-500/15",
        statusText: "text-amber-600",
        statusBorder: "border-amber-400/30",
        cardBg: "bg-gradient-to-br from-orange-50 via-amber-50/80 to-white",
        cardBorder: "border-amber-200/60",
        cardHover: "hover:border-amber-300 hover:shadow-amber-100/50",
        accentColor: "text-amber-600",
        accentBg: "bg-amber-500",
        iconBg: "bg-amber-100",
        statBg: "bg-amber-50",
        markets: ["🇷🇴 Romania", "🇭🇷 Croatia", "🇮🇹 Italy"],
        currency: "RON",
        description: "E-commerce fashion — dresses, watches, jewelry. COD model with EU shipping.",
        stats: [
            { label: "Markets", value: "4", icon: Globe },
            { label: "Products", value: "17", icon: Package },
            { label: "Marketers", value: "2", icon: Users },
        ],
    },
    {
        id: "AUUS1",
        name: "AUUS1",
        subtitle: "AU / US Markets",
        route: "/auus1",
        status: "Active",
        statusBg: "bg-emerald-500/15",
        statusText: "text-emerald-600",
        statusBorder: "border-emerald-400/30",
        cardBg: "bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white",
        cardBorder: "border-emerald-200/60",
        cardHover: "hover:border-emerald-300 hover:shadow-emerald-100/50",
        accentColor: "text-emerald-600",
        accentBg: "bg-emerald-500",
        iconBg: "bg-emerald-100",
        statBg: "bg-emerald-50",
        markets: ["🇦🇺 Australia", "🇺🇸 United States"],
        currency: "VND",
        description: "International e-commerce — multi-market with AU/US product mapping.",
        stats: [
            { label: "Markets", value: "2", icon: Globe },
            { label: "Channels", value: "Multi", icon: TrendingUp },
            { label: "Status", value: "Live", icon: Zap },
        ],
    },
    {
        id: "TALPHA",
        name: "TALPHA",
        subtitle: "Tiểu Alpha — Middle East",
        route: "/talpha",
        status: "Active",
        statusBg: "bg-violet-500/15",
        statusText: "text-violet-600",
        statusBorder: "border-violet-400/30",
        cardBg: "bg-gradient-to-br from-violet-50 via-purple-50/80 to-white",
        cardBorder: "border-violet-200/60",
        cardHover: "hover:border-violet-300 hover:shadow-violet-100/50",
        accentColor: "text-violet-600",
        accentBg: "bg-violet-500",
        iconBg: "bg-violet-100",
        statBg: "bg-violet-50",
        markets: ["🇸🇦 Saudi", "🇦🇪 UAE", "🇰🇼 Kuwait", "🇴🇲 Oman"],
        currency: "SAR / AED / KWD / OMR",
        description: "Multi-market Middle East — jewelry, cosmetics, health. COD model with Aramex.",
        stats: [
            { label: "Markets", value: "6", icon: Globe },
            { label: "Products", value: "30+", icon: Package },
            { label: "Marketers", value: "7", icon: Users },
        ],
    },
];

export default function AdminHome() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
            {/* Hero Header */}
            <header className="relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

                <div className="relative max-w-7xl mx-auto px-8 py-10">
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-indigo-900/20 border border-white/10">
                                    <Zap className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                                        FAOS
                                    </h1>
                                    <p className="text-xs text-indigo-200 font-medium tracking-wide">
                                        Federated Agent Operating System
                                    </p>
                                </div>
                            </div>
                            <p className="text-indigo-100/80 text-sm max-w-lg leading-relaxed">
                                Multi-project e-commerce operations platform. Chọn dự án để xem dashboard chi tiết.
                            </p>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="text-right">
                                <span className="text-[10px] text-indigo-200/70 uppercase tracking-widest block mb-0.5">Platform</span>
                                <span className="text-lg font-bold text-white">v5.0</span>
                            </div>
                            <div className="h-10 w-px bg-white/20 rounded-full" />
                            <div className="text-right">
                                <span className="text-[10px] text-indigo-200/70 uppercase tracking-widest block mb-0.5">Projects</span>
                                <span className="text-lg font-bold text-white">{PROJECTS.length} <span className="text-sm font-normal text-indigo-200">active</span></span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Bottom curve */}
                <div className="absolute -bottom-1 left-0 right-0">
                    <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
                        <path d="M0 40V20C240 0 480 0 720 10C960 20 1200 30 1440 20V40H0Z" fill="rgb(248 250 252)" />
                    </svg>
                </div>
            </header>

            {/* Project Cards Grid */}
            <main className="max-w-7xl mx-auto px-8 py-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PROJECTS.map((project) => (
                        <Link
                            key={project.id}
                            href={project.route}
                            className={`group relative overflow-hidden rounded-2xl border ${project.cardBorder} ${project.cardBg} transition-all duration-300 ${project.cardHover} hover:shadow-xl hover:-translate-y-1`}
                        >
                            {/* Top accent bar */}
                            <div className={`h-1 w-full ${project.accentBg}`} />

                            <div className="relative p-6">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-1.5">
                                            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                                                {project.name}
                                            </h2>
                                            <span className={`rounded-full border ${project.statusBorder} ${project.statusBg} ${project.statusText} px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`}>
                                                {project.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">{project.subtitle}</p>
                                    </div>
                                    <div className={`h-9 w-9 rounded-xl ${project.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                        <ArrowRight className={`h-4 w-4 ${project.accentColor} group-hover:translate-x-0.5 transition-transform`} />
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-slate-500 mb-5 leading-relaxed line-clamp-2">
                                    {project.description}
                                </p>

                                {/* Markets */}
                                <div className="flex flex-wrap gap-1.5 mb-5">
                                    {project.markets.map((market) => (
                                        <span
                                            key={market}
                                            className="rounded-lg bg-white/80 border border-slate-200/80 px-2.5 py-1 text-xs text-slate-600 font-medium shadow-sm"
                                        >
                                            {market}
                                        </span>
                                    ))}
                                    <span className="rounded-lg bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-xs text-slate-400 font-medium">
                                        {project.currency}
                                    </span>
                                </div>

                                {/* Stats */}
                                <div className={`grid grid-cols-3 gap-3 pt-4 border-t border-slate-200/60`}>
                                    {project.stats.map((stat) => (
                                        <div key={stat.label} className={`text-center rounded-xl ${project.statBg} py-2.5 transition-colors`}>
                                            <stat.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${project.accentColor} opacity-60`} />
                                            <p className={`text-lg font-bold ${project.accentColor}`}>{stat.value}</p>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
                                                {stat.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Quick Access Row */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* AI Brain Command Center */}
                    <Link
                        href="/ai-brain"
                        className="group flex items-center justify-between rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/80 to-indigo-50/60 p-5 transition-all duration-300 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-100/40 hover:-translate-y-0.5"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-200/50">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">🧠 AI Brain</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Services • Agents • OpenClaw</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>

                    {/* Admin Panel Link */}
                    <Link
                        href="/admin"
                        className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/40"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200/50">
                                <Settings className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Quản trị hệ thống</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Token Cost • Trợ lý AI • Config</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>

                    {/* Analytics Overview Link */}
                    <Link
                        href="/ads-command-center"
                        className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200/50">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Ads Command Center</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Performance • Campaigns • Analytics</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center pb-8">
                    <div className="flex items-center justify-center gap-2 text-slate-300">
                        <Layers className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium tracking-wide">FAOS Platform v5.0</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
