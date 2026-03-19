"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ComposedChart, Line, Cell,
} from "recharts";
import { KPICard } from "@/components/ui/kpi-card";
import { formatVNDCompact, formatCurrency, formatMoney, formatNumber, toVND, cn } from "../utils";
import { DATASET } from "../constants";
import TabSkeleton from "@/components/ui/tab-skeleton";
import {
    Crown, TrendingUp, TrendingDown, DollarSign,
    Users, Globe, Package, Target, Sparkles, Activity, ArrowUpRight
} from "lucide-react";

interface Props { dateRange?: { from: Date; to: Date }; projectId?: string }

interface MonthlyRow {
    month: string; orders: number; revenue: number; ads_spend: number; net_profit: number;
}
interface MarketerRow {
    marketer: string; orders: number; revenue: number; ads_spend: number; roas: number; net_profit: number;
}
interface MarketRow {
    market: string; orders: number; revenue: number; ads_spend: number; margin: number;
}
interface ProductRow {
    product_name: string; quantity: number; revenue: number;
}

function gradeMarketer(roas: number, netProfit: number): { label: string; color: string; glow: string } {
    if (roas >= 5) return { label: "A+", color: "text-teal-600", glow: "bg-blue-50" };
    if (roas >= 3.5) return { label: "A", color: "text-teal-600", glow: "bg-blue-50" };
    if (roas >= 2.5) return { label: "B+", color: "text-amber-500", glow: "bg-amber-50" };
    if (netProfit < 0) return { label: "C", color: "text-red-500", glow: "bg-red-50" };
    return { label: "B", color: "text-indigo-500", glow: "bg-indigo-50" };
}

export default function TALPHACeoOverviewTab({ dateRange }: Props) {
    const [loading, setLoading] = useState(true);
    const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
    const [marketers, setMarketers] = useState<MarketerRow[]>([]);
    const [markets, setMarkets] = useState<MarketRow[]>([]);
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [totals, setTotals] = useState({ orders: 0, revenue: 0, ads: 0, net: 0, markets: 0 });

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const from = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "2025-01-01";
                const to = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

                const queries = [
                    // Q0: Monthly revenue by shop (for VND) + monthly ads spend
                    `SELECT
                        FORMAT_DATE('%Y-%m', DATE(inserted_at)) as month,
                        shop_name,
                        COUNT(DISTINCT id) as orders,
                        ROUND(SUM(total_price), 2) as revenue
                    FROM \`levelup-465304.${DATASET}.sale_order\`
                    WHERE DATE(inserted_at) BETWEEN '${from}' AND '${to}' AND total_price > 0
                    GROUP BY 1, 2 ORDER BY 1`,

                    // Q1: Monthly ads spend
                    `SELECT
                        FORMAT_DATE('%Y-%m', DATE(date_start)) as month,
                        ROUND(SUM(spend), 0) as ads_spend
                    FROM \`levelup-465304.${DATASET}.fb_ads_data\`
                    WHERE DATE(date_start) BETWEEN '${from}' AND '${to}' AND spend > 0
                    GROUP BY 1 ORDER BY 1`,

                    // Q2: Marketer performance
                    `SELECT
                        COALESCE(NULLIF(o.marketer, ''), NULLIF(o.pke_mkter, ''), 'Unknown') as marketer,
                        o.shop_name,
                        COUNT(DISTINCT o.id) as orders,
                        ROUND(SUM(o.total_price), 2) as revenue,
                        ROUND(SUM(CASE WHEN a.ad_id IS NOT NULL THEN a.spend ELSE 0 END), 0) as ads_spend
                    FROM \`levelup-465304.${DATASET}.sale_order\` o
                    LEFT JOIN (
                        SELECT ad_id, ROUND(AVG(spend), 2) as spend
                        FROM \`levelup-465304.${DATASET}.fb_ads_data\`
                        WHERE DATE(date_start) BETWEEN '${from}' AND '${to}'
                        GROUP BY 1
                    ) a ON o.ad_id = a.ad_id
                    WHERE DATE(o.inserted_at) BETWEEN '${from}' AND '${to}' AND o.total_price > 0
                    GROUP BY 1, 2 ORDER BY revenue DESC`,

                    // Q3: Market breakdown
                    `SELECT
                        shop_name,
                        COUNT(DISTINCT id) as orders,
                        ROUND(SUM(total_price), 2) as revenue
                    FROM \`levelup-465304.${DATASET}.sale_order\`
                    WHERE DATE(inserted_at) BETWEEN '${from}' AND '${to}' AND total_price > 0
                    GROUP BY 1 ORDER BY revenue DESC`,

                    // Q4: Market ads spend
                    `SELECT
                        CASE
                            WHEN campaign_name LIKE '%Saudi%' OR campaign_name LIKE '%SA%' THEN 'Saudi'
                            WHEN campaign_name LIKE '%UAE%' OR campaign_name LIKE '%Dubai%' OR campaign_name LIKE '%AE%' THEN 'UAE'
                            WHEN campaign_name LIKE '%Kuwait%' OR campaign_name LIKE '%KW%' THEN 'Kuwait'
                            WHEN campaign_name LIKE '%Oman%' OR campaign_name LIKE '%OM%' THEN 'Oman'
                            WHEN campaign_name LIKE '%Qatar%' OR campaign_name LIKE '%QA%' THEN 'Qatar'
                            WHEN campaign_name LIKE '%Bahrain%' OR campaign_name LIKE '%BH%' THEN 'Bahrain'
                            ELSE 'Other'
                        END as market,
                        ROUND(SUM(spend), 0) as ads_spend
                    FROM \`levelup-465304.${DATASET}.fb_ads_data\`
                    WHERE DATE(date_start) BETWEEN '${from}' AND '${to}' AND spend > 0
                    GROUP BY 1`,

                    // Q5: Top products
                    `SELECT
                        COALESCE(NULLIF(oi.product_name, ''), 'Unknown') as product_name,
                        SUM(oi.quantity) as quantity,
                        ROUND(SUM(oi.retail_price * oi.quantity), 2) as revenue_local,
                        STRING_AGG(DISTINCT o.shop_name, ', ') as shops
                    FROM \`levelup-465304.${DATASET}.order_items\` oi
                    LEFT JOIN \`levelup-465304.${DATASET}.sale_order\` o ON oi.order_id = CAST(o.id AS STRING)
                    WHERE o.total_price > 0
                    GROUP BY 1 ORDER BY quantity DESC LIMIT 10`,

                    // Q6: Total ads spend
                    `SELECT ROUND(SUM(spend), 0) as total_ads
                    FROM \`levelup-465304.${DATASET}.fb_ads_data\`
                    WHERE DATE(date_start) BETWEEN '${from}' AND '${to}' AND spend > 0`,
                ];

                const results = await Promise.all(
                    queries.map(q =>
                        fetch("/api/query", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ query: q })
                        }).then(r => r.json()).catch(() => ({ data: [] }))
                    )
                );

                const monthRevMap = new Map<string, { orders: number; revenue: number }>();
                for (const r of results[0].data || []) {
                    const m = r.month || "";
                    const rev = toVND(r.revenue || 0, r.shop_name);
                    const ex = monthRevMap.get(m);
                    if (ex) { ex.orders += r.orders || 0; ex.revenue += rev; }
                    else monthRevMap.set(m, { orders: r.orders || 0, revenue: rev });
                }
                const monthAdsMap = new Map<string, number>();
                for (const r of results[1].data || []) {
                    monthAdsMap.set(r.month || "", r.ads_spend || 0);
                }
                const allMonths = new Set([...monthRevMap.keys(), ...monthAdsMap.keys()]);
                const monthlyArr: MonthlyRow[] = Array.from(allMonths).sort().map(m => {
                    const rev = monthRevMap.get(m)?.revenue || 0;
                    const orders = monthRevMap.get(m)?.orders || 0;
                    const ads = monthAdsMap.get(m) || 0;
                    return { month: m, orders, revenue: rev, ads_spend: ads, net_profit: rev - ads };
                });
                setMonthly(monthlyArr);

                const mkMap = new Map<string, MarketerRow>();
                for (const r of results[2].data || []) {
                    let name = (r.marketer || "").trim();
                    if (!name || name === "Unknown" || name === "None" || name === "null"
                        || name.includes("{") || name.length > 50) continue;
                    const rev = toVND(r.revenue || 0, r.shop_name);
                    const ads = r.ads_spend || 0;
                    const ex = mkMap.get(name);
                    if (ex) { ex.orders += r.orders || 0; ex.revenue += rev; ex.ads_spend += ads; }
                    else mkMap.set(name, { marketer: name, orders: r.orders || 0, revenue: rev, ads_spend: ads, roas: 0, net_profit: 0 });
                }
                const mkArr = Array.from(mkMap.values()).map(m => ({
                    ...m,
                    roas: m.ads_spend > 0 ? Math.round((m.revenue / m.ads_spend) * 100) / 100 : 0,
                    net_profit: m.revenue - m.ads_spend,
                })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
                setMarketers(mkArr);

                const mktAdsMap = new Map<string, number>();
                for (const r of results[4].data || []) {
                    mktAdsMap.set(r.market || "", r.ads_spend || 0);
                }
                const marketsArr: MarketRow[] = (results[3].data || []).map((r: any) => {
                    const rev = toVND(r.revenue || 0, r.market);
                    const ads = mktAdsMap.get(r.market) || 0;
                    return {
                        market: r.shop_name || "Unknown", orders: r.orders || 0, revenue: rev,
                        ads_spend: ads, margin: rev > 0 ? Math.round(((rev - ads) / rev) * 1000) / 10 : 0,
                    };
                });
                setMarkets(marketsArr);

                const prodArr = (results[5].data || []).map((r: any) => ({
                    product_name: r.product_name || "Unknown",
                    quantity: r.quantity || 0,
                    revenue: toVND(r.revenue_local || 0, (r.shops || "").split(",")[0]?.trim()),
                }));
                setProducts(prodArr);

                const totalRev = monthlyArr.reduce((s, m) => s + m.revenue, 0);
                const totalOrders = monthlyArr.reduce((s, m) => s + m.orders, 0);
                const totalAds = results[6].data?.[0]?.total_ads || 0;
                setTotals({
                    orders: totalOrders, revenue: totalRev, ads: totalAds,
                    net: totalRev - totalAds, markets: marketsArr.length,
                });
            } catch (e) { console.error("CEO fetch error", e); } finally { setLoading(false); }
        }
        fetchData();
    }, [dateRange]);

    if (loading) return <TabSkeleton cards={6} showChart={true} rows={5} />;

    const overallRoas = totals.ads > 0 ? totals.revenue / totals.ads : 0;
    const overallMargin = totals.revenue > 0 ? (totals.net / totals.revenue) * 100 : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* KPI Section */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <KPICard title="Tổng Doanh Thu" value={formatCurrency(totals.revenue)} icon={DollarSign}
                    status={totals.revenue > 0 ? "success" : "neutral"}
                    subValue={`${monthly.length} tháng dữ liệu`} />
                <KPICard title="Lợi Nhuận Ròng" value={formatCurrency(totals.net)} icon={totals.net >= 0 ? TrendingUp : TrendingDown}
                    status={totals.net >= 0 ? "success" : "danger"}
                    subValue={`Margin: ${overallMargin.toFixed(1)}%`} />
                <KPICard title="Tổng Đơn Hàng" value={formatNumber(totals.orders)} icon={Package}
                    status="neutral" subValue={`AOV: ${formatCurrency(totals.orders > 0 ? totals.revenue / totals.orders : 0)}`} />
                <KPICard title="Hiệu Quả ROAS" value={`${overallRoas.toFixed(2)}x`} icon={Target}
                    status={overallRoas >= 2.5 ? "success" : overallRoas >= 1.5 ? "warning" : "danger"}
                    subValue={`Ads: ${formatCurrency(totals.ads)}`} />
                <KPICard title="Đội Ngũ Marketing" value={String(marketers.length)} icon={Users}
                    status="neutral" subValue="Đang hoạt động" />
                <KPICard title="Thị Trường" value={String(totals.markets)} icon={Globe}
                    status="neutral" subValue={markets.slice(0, 3).map(m => m.market).join(", ")} />
            </div>

            {/* Chi phí chi tiết */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/80">
                <h3 className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Phân tích cấu trúc chi phí
                </h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Quảng cáo</div>
                        <div className="text-xl font-black text-slate-700">{formatCurrency(totals.ads)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Giá vốn (COGS)</div>
                        <div className="text-xs font-medium text-slate-300 italic">Đang cập nhật...</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Vận chuyển</div>
                        <div className="text-xs font-medium text-slate-300 italic">Đang cập nhật...</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Tổng chi phí</div>
                        <div className="text-xl font-black text-slate-700">{formatCurrency(totals.ads)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-50 border border-teal-200/50">
                        <div className="text-[10px] font-bold text-teal-600/70 uppercase mb-2">Lợi nhuận ròng</div>
                        <div className={cn("text-xl font-black", totals.net >= 0 ? "text-teal-600" : "text-red-500")}>
                            {formatCurrency(totals.net)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Rankings Section */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Marketer Ranking */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Crown className="h-3 w-3 text-blue-500" /> Marketer Performance
                    </h3>
                    <div className="space-y-4 text-xs">
                        {marketers.map((m, i) => {
                            const grade = gradeMarketer(m.roas, m.net_profit);
                            return (
                                <div key={m.marketer} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] font-black text-slate-300">#{(i + 1).toString().padStart(2, '0')}</span>
                                        <div>
                                            <div className="font-bold text-slate-800">{m.marketer?.split(" ").slice(-2).join(" ")}</div>
                                            <div className="text-[10px] font-medium text-slate-400">ROAS: {m.roas}x</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("font-bold text-sm", m.net_profit >= 0 ? "text-teal-600" : "text-red-500")}>
                                            {formatMoney(m.net_profit)}
                                        </div>
                                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 shadow-sm", grade.glow, grade.color)}>
                                            {grade.label}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Product Ranking */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Package className="h-3 w-3 text-indigo-400" /> Best Selling Products
                    </h3>
                    <div className="space-y-4">
                        {products.slice(0, 6).map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="text-xs font-bold text-slate-800 truncate" title={p.product_name}>
                                        {p.product_name}
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400">Số lượng: {p.quantity}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-indigo-600">{formatMoney(p.revenue)}</div>
                                    <ArrowUpRight className="h-3 w-3 text-slate-300 inline-block" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Market Ranking */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Globe className="h-3 w-3 text-blue-400" /> Market Efficiency
                    </h3>
                    <div className="space-y-4">
                        {markets.map((m) => (
                            <div key={m.market} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all">
                                <div>
                                    <div className="text-xs font-bold text-slate-800">{m.market}</div>
                                    <div className="text-[10px] font-medium text-slate-400">{formatNumber(m.orders)} đơn hàng</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-slate-700">{formatMoney(m.revenue)}</div>
                                    <div className={cn("text-[10px] font-bold mt-1",
                                        m.margin >= 50 ? "text-teal-600" : m.margin >= 30 ? "text-amber-500" : "text-red-500")}>
                                        Margin: {m.margin}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="mb-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Activity className="h-3 w-3 text-blue-500" /> Doanh thu và Lợi nhuận hàng tháng
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={monthly}>
                        <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => formatVNDCompact(v)} />
                        <Tooltip
                            contentStyle={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(10px)", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}
                            labelStyle={{ color: "#475569", fontSize: 11, fontWeight: 800, marginBottom: 4 }}
                            itemStyle={{ fontSize: 12, fontWeight: 700 }}
                            formatter={(v: any) => [formatVNDCompact(Number(v)), ""]}
                        />
                        <Bar dataKey="revenue" name="Doanh Thu" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                        <Bar dataKey="ads_spend" name="Chi Phí Ads" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                        <Line type="monotone" dataKey="net_profit" name="Lợi Nhuận Ròng" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2, stroke: "#14b8a6" }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Bảng chi tiết P&L theo tháng</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                                <th className="px-6 py-4">Thời gian</th>
                                <th className="px-6 py-4 text-right">Đơn hàng</th>
                                <th className="px-6 py-4 text-right">Doanh thu</th>
                                <th className="px-6 py-4 text-right">Quảng cáo</th>
                                <th className="px-6 py-4 text-right">Lợi nhuận</th>
                                <th className="px-6 py-4 text-right">Tỷ lệ Lợi nhuận</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {monthly.map((m) => {
                                const margin = m.revenue > 0 ? ((m.net_profit / m.revenue) * 100) : 0;
                                return (
                                    <tr key={m.month} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-slate-700">{m.month}</td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-500">{formatNumber(m.orders)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">{formatMoney(m.revenue)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-amber-500">{formatMoney(m.ads_spend)}</td>
                                        <td className={cn("px-6 py-4 text-right font-bold", m.net_profit >= 0 ? "text-teal-600" : "text-red-500")}>
                                            {formatMoney(m.net_profit)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={cn("inline-block px-2.5 py-1 rounded-full font-bold text-[10px]",
                                                margin >= 30 ? "bg-blue-50 text-teal-600 border border-teal-100" : margin >= 10 ? "bg-amber-50 text-amber-500 border border-amber-100" : "bg-red-50 text-red-500 border border-rose-100")}>
                                                {margin.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-200">
                                <td className="px-6 py-5 text-slate-900 uppercase tracking-tighter">Tổng kết</td>
                                <td className="px-6 py-5 text-right text-slate-700">{formatNumber(totals.orders)}</td>
                                <td className="px-6 py-5 text-right text-slate-900 font-black">{formatMoney(totals.revenue)}</td>
                                <td className="px-6 py-5 text-right text-amber-500">{formatMoney(totals.ads)}</td>
                                <td className={cn("px-6 py-5 text-right font-black", totals.net >= 0 ? "text-teal-600" : "text-red-500")}>
                                    {formatMoney(totals.net)}
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <span className="text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-200">{overallMargin.toFixed(1)}%</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
