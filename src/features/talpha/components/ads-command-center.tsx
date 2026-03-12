"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import {
    RotateCw, Satellite, Layers, AlertTriangle, ChevronDown, ChevronRight,
    Check, Zap, Target, TrendingUp, Save, Sparkles, Activity
} from "lucide-react";
import { cn, formatVNDCompact } from "@/shared/utils";

// ── types ──
interface AdDetail {
    ad_id: string; ad_name: string; adset_name: string;
    spend_vnd: number; impressions: number; messages: number; purchases: number;
    orders: number; revenue_vnd: number; roas: number;
}

interface RealtimeCampaign {
    account_id: string; campaign_id: string; campaign_name: string;
    spend_vnd: number; impressions: number; messages: number;
    purchases: number; orders: number; revenue_vnd: number; roas: number;
    ads: AdDetail[];
}

interface RealtimeData {
    success: boolean;
    date: string;
    total_spend: number;
    total_revenue: number;
    total_orders: number;
    total_messages: number;
    ads: any[];
}

const ACCOUNT_NAMES: Record<string, string> = {
    "act_1503790877534258": "Tiểu Alpha 3",
    "act_855567553811483": "Sỹ Lộc 01",
    "act_934116652330312": "Sỹ Lộc 02",
    "act_1284981146939856": "Sỹ Lộc 03",
    "act_1895495471105125": "Sỹ Lộc 04",
    "act_833593695771745": "Chu Thuý 01",
    "act_848995974322757": "Chu Thuý 02",
    "act_1461543545434816": "Chu Thuý 03",
    "act_1437142241537275": "Chu Thuý 04",
    "act_1670240591020196": "N.Thế 01",
    "act_946287684758283": "N.Thế 02",
    "act_916423977810241": "N.Thế 03",
    "act_2126483347927326": "Thục Mai 01",
    "act_3534017756739334": "Kuwait +3",
    "act_703242242813144": "Trang Sức +1",
    "act_917487764374311": "Thục Bình 01",
    "act_1338833310964388": "Tk VND",
    "act_1119368126847210": "Trang sức 2 - Dubai",
    "act_1223948656596727": "Nhung LevelUp - 01",
    "act_962218859667133": "S.ANH - 01 - ĐÔNG Á",
    "act_939548861921691": "S.ANH - 02 - ĐÔNG Á",
};

export default function AdsCommandCenter() {
    const [data, setData] = useState<RealtimeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get("/api/talpha/realtime", { params: { from_date: date } });
            setData(res.data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (autoRefresh) {
            const interval = setInterval(fetchData, 60000);
            return () => clearInterval(interval);
        }
    }, [date, autoRefresh]);

    const syncToSheet = async () => {
        if (!data) return;
        setSyncing(true);
        try {
            await axios.post("/api/talpha/realtime", {
                date,
                sheet_id: "1-kY-bLJUYS_PPogDVydY1T330D67Cj2RK8lF8E1rzoI"
            });
            alert("Đã đồng bộ thành công lên Google Sheet tab '2026 auto'!");
        } catch (err: any) {
            alert("Lỗi đồng bộ: " + err.response?.data?.error || err.message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header controls */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500 font-bold">
                        <Satellite className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Ads Command Center</h1>
                        <p className="text-xs text-slate-400 flex items-center gap-2">
                            <Sparkles className="w-3 h-3 text-amber-500" /> Hệ thống V5.1 — 2026 Auto Sync Active
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <input
                            type="checkbox"
                            id="auto-refresh"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="accent-violet-500 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="auto-refresh" className="text-xs text-slate-500 cursor-pointer flex items-center gap-1.5">
                            Auto 60s
                            {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>}
                        </label>
                    </div>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-violet-400/50"
                    />
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition"
                    >
                        <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Làm mới
                    </button>
                    <button
                        onClick={syncToSheet}
                        disabled={syncing || !data}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg px-4 py-2 text-sm font-bold shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                    >
                        {syncing ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu vào Sheet
                    </button>
                </div>
            </header>

            {/* Main Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng Chi phí Ads" value={formatVNDCompact(data?.total_spend || 0)} icon={<Activity className="w-4 h-4" />} color="blue" />
                <StatCard label="Số Tin nhắn" value={data?.total_messages || 0} icon={<Activity className="w-4 h-4" />} color="indigo" />
                <StatCard label="Tổng Số Đơn" value={data?.total_orders || 0} icon={<Activity className="w-4 h-4" />} color="purple" />
                <StatCard label="Doanh thu thực tế" value={formatVNDCompact(data?.total_revenue || 0)} icon={<TrendingUp className="w-4 h-4" />} color="emerald" />
            </div>

            {/* Summary Data */}
            <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-violet-400" /> Phân tích Chỉ số Hiệu quả
                    </h2>
                    <div className="flex gap-4 text-xs font-mono">
                        <span className="text-teal-600">ROAS: {((data?.total_revenue || 0) / (data?.total_spend || 1)).toFixed(2)}x</span>
                        <span className="text-violet-500">CPA: {formatVNDCompact((data?.total_spend || 0) / (data?.total_orders || 1))}</span>
                    </div>
                </div>
                <div className="p-6">
                    {/* Simplified table for V5.1 */}
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-100 uppercase text-[10px] font-bold tracking-wider">
                                <th className="pb-4">Chiến dịch / TKQC</th>
                                <th className="pb-4 text-right">Chi phí</th>
                                <th className="pb-4 text-right">Tin nhắn</th>
                                <th className="pb-4 text-right text-violet-500">CPA Msg</th>
                                <th className="pb-4 text-right text-teal-500">Đơn POS</th>
                                <th className="pb-4 text-right">ROAS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.ads && data.ads.length > 0 ? (
                                data.ads.map((ad: any, idx: number) => (
                                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                        <td className="py-4">
                                            <div className="font-medium text-slate-700">{ad.campaign_name}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">{ACCOUNT_NAMES[ad.account_id] || ad.account_id}</div>
                                        </td>
                                        <td className="py-4 text-right font-mono text-slate-600">{formatVNDCompact(ad.spend_vnd)}</td>
                                        <td className="py-4 text-right font-mono text-violet-500">{ad.messages}</td>
                                        <td className="py-4 text-right font-mono text-violet-400">{formatVNDCompact(ad.spend_vnd / (ad.messages || 1))}</td>
                                        <td className="py-4 text-right font-mono text-teal-500">{ad.orders}</td>
                                        <td className="py-4 text-right font-mono font-bold text-teal-600">
                                            {((ad.revenue_vnd || 0) / (ad.spend_vnd || 1)).toFixed(2)}x
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-400 italic">
                                        Không tìm thấy dữ liệu cho ngày {date}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function StatCard({ label, value, icon, color }: any) {
    const colorMap: any = {
        blue: "text-blue-400 bg-blue-500/10",
        emerald: "text-emerald-400 bg-emerald-500/10",
        indigo: "text-indigo-400 bg-indigo-500/10",
        purple: "text-purple-400 bg-purple-500/10"
    };

    return (
        <div className="bg-white p-6 rounded-2xl flex items-center gap-6 border border-slate-100 shadow-sm group hover:shadow-md transition-all">
            <div className={cn("p-4 rounded-xl", colorMap[color])}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{label}</p>
                <div className="text-2xl font-bold font-mono text-slate-800">{value}</div>
            </div>
        </div>
    );
}
