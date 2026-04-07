"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useProject } from "@/app/agent-control/layout";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";

/* ─── Types ──────────────────────────────────────── */
interface AccuracyPoint {
    date: string;
    avg_accuracy: number;
    correct: number;
    total: number;
}

interface ApprovalLog {
    decision_id: string;
    action_type: string;
    campaign_id: string;
    status: string;
    risk_level: number;
    percentage_change: number | null;
    decided_by: string | null;
    decided_at: string | null;
    channel: string | null;
    outcome_verdict: string | null;
    created_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Verdict badge ── */
const VerdictBadge = ({ verdict }: { verdict: string | null }) => {
    if (!verdict)
        return (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-500">
                PENDING
            </span>
        );
    const map: Record<string, { bg: string; text: string; label: string }> = {
        POSITIVE: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "WIN" },
        NEGATIVE: { bg: "bg-red-500/15", text: "text-red-400", label: "LOSS" },
        NEUTRAL: { bg: "bg-gray-700/40", text: "text-gray-400", label: "NEUTRAL" },
    };
    const s = map[verdict] || map.NEUTRAL;
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

/* ── Status badge ── */
const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; text: string }> = {
        APPROVED: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
        AUTO_APPROVED: { bg: "bg-indigo-500/15", text: "text-indigo-400" },
        REJECTED: { bg: "bg-red-500/15", text: "text-red-400" },
        ROLLED_BACK: { bg: "bg-amber-500/15", text: "text-amber-400" },
        PENDING: { bg: "bg-gray-700/40", text: "text-gray-400" },
        EXPIRED: { bg: "bg-gray-700/40", text: "text-gray-500" },
    };
    const s = map[status] || map.PENDING;
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${s.bg} ${s.text}`}>
            {status.replace("_", " ")}
        </span>
    );
};

/* ── Action icon ── */
const actionIcon = (action: string) => {
    const icons: Record<string, string> = {
        scale_budget: "📈",
        pause_adset: "⏸️",
        kill_campaign: "💀",
        new_campaign: "🆕",
        update_rule: "📝",
    };
    return icons[action] || "⚡";
};

/* ── Skeleton ── */
const ChartSkeleton = () => (
    <div className="h-64 bg-gray-900/30 rounded-lg animate-pulse flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-700">
            <div className="w-10 h-10 rounded-full border-2 border-gray-800 border-t-gray-600 animate-spin" />
            <span className="text-xs">Loading chart data...</span>
        </div>
    </div>
);

const TableSkeleton = () => (
    <div className="space-y-2 p-5">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-900/30 rounded-lg animate-pulse" />
        ))}
    </div>
);

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#141b2d] border border-gray-700/50 rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
                    {p.name}: {p.value}%
                </p>
            ))}
        </div>
    );
};

/* ─── Component ──────────────────────────────────── */
export default function AIAuditDashboard() {
    const { projectId } = useProject();
    const [accuracy, setAccuracy] = useState<AccuracyPoint[]>([]);
    const [logs, setLogs] = useState<ApprovalLog[]>([]);
    const [loadingChart, setLoadingChart] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [days, setDays] = useState(30);

    /* ── Fetch accuracy ── */
    const fetchAccuracy = useCallback(async () => {
        setLoadingChart(true);
        try {
            const res = await fetch(
                `${API}/api/ai-intelligence/accuracy?project_id=${projectId}&days=${days}`
            );
            const json = await res.json();
            setAccuracy((json.data || []).reverse());
        } catch {
            setAccuracy([]);
        } finally {
            setLoadingChart(false);
        }
    }, [projectId, days]);

    /* ── Fetch logs ── */
    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch(
                `${API}/api/audit/approvals?project_id=${projectId}&days=${days}&limit=100`
            );
            const json = await res.json();
            setLogs(json.data || []);
        } catch {
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    }, [projectId, days]);

    useEffect(() => {
        fetchAccuracy();
        fetchLogs();
    }, [fetchAccuracy, fetchLogs]);

    /* ── Stats from logs ── */
    const wins = logs.filter((l) => l.outcome_verdict === "POSITIVE").length;
    const losses = logs.filter((l) => l.outcome_verdict === "NEGATIVE").length;
    const neutral = logs.filter((l) => l.outcome_verdict === "NEUTRAL").length;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <span className="text-2xl">📊</span> AI Audit Dashboard
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Performance tracking for{" "}
                        <span className="text-indigo-400 font-semibold">
                            {projectId.toUpperCase()}
                        </span>
                    </p>
                </div>
                {/* Days selector */}
                <div className="flex items-center gap-2">
                    {[7, 14, 30].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${days === d
                                    ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                                    : "bg-gray-900/30 text-gray-500 border-gray-800/50 hover:text-gray-300 hover:border-gray-600"
                                }`}
                        >
                            {d}D
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Win Rate", value: `${winRate}%`, color: "text-emerald-400", icon: "🏆" },
                    { label: "Wins", value: wins, color: "text-emerald-400", icon: "✅" },
                    { label: "Losses", value: losses, color: "text-red-400", icon: "❌" },
                    { label: "Neutral", value: neutral, color: "text-gray-400", icon: "➖" },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                            <span className="text-base">{s.icon}</span>
                        </div>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ═══ ACCURACY CHART ═══ */}
            <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center text-[10px]">
                            📈
                        </span>
                        Prediction Accuracy Over Time
                    </h3>
                    <span className="text-[10px] text-gray-600">
                        {accuracy.length} data points
                    </span>
                </div>
                <div className="p-5">
                    {loadingChart ? (
                        <ChartSkeleton />
                    ) : accuracy.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-600">
                            <div className="text-center">
                                <p className="text-3xl mb-2">📭</p>
                                <p className="text-sm">No accuracy data yet</p>
                                <p className="text-xs text-gray-700 mt-1">
                                    Data appears after T+1 reflection runs
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={accuracy}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: "#64748b", fontSize: 11 }}
                                    tickFormatter={(v) => v.slice(5)}
                                    stroke="#1e293b"
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fill: "#64748b", fontSize: 11 }}
                                    stroke="#1e293b"
                                    tickFormatter={(v) => `${v}%`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                                />
                                <ReferenceLine
                                    y={70}
                                    stroke="#f59e0b"
                                    strokeDasharray="5 5"
                                    label={{ value: "Target 70%", fill: "#f59e0b", fontSize: 10 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="avg_accuracy"
                                    name="Avg Accuracy"
                                    stroke="#818cf8"
                                    strokeWidth={2}
                                    dot={{ fill: "#818cf8", r: 3 }}
                                    activeDot={{ r: 5, fill: "#818cf8" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ═══ APPROVAL LOGS TABLE ═══ */}
            <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-[10px]">
                            📋
                        </span>
                        Decision History
                    </h3>
                    <span className="text-[10px] text-gray-600">
                        {logs.length} decisions
                    </span>
                </div>

                {loadingLogs ? (
                    <TableSkeleton />
                ) : logs.length === 0 ? (
                    <div className="p-10 text-center text-gray-600">
                        <p className="text-2xl mb-2">📭</p>
                        <p className="text-sm">No decisions logged yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wider text-gray-600 border-b border-gray-800/40">
                                    <th className="px-5 py-2.5 text-left font-semibold">Date</th>
                                    <th className="px-3 py-2.5 text-left font-semibold">Action</th>
                                    <th className="px-3 py-2.5 text-left font-semibold">Campaign</th>
                                    <th className="px-3 py-2.5 text-center font-semibold">Change</th>
                                    <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                                    <th className="px-3 py-2.5 text-center font-semibold">By</th>
                                    <th className="px-3 py-2.5 text-center font-semibold">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {logs.map((log) => (
                                    <tr
                                        key={log.decision_id}
                                        className="hover:bg-gray-800/20 transition-colors"
                                    >
                                        <td className="px-5 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                                            {log.created_at?.slice(0, 10) || "—"}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className="flex items-center gap-1.5">
                                                <span>{actionIcon(log.action_type)}</span>
                                                <span className="text-gray-300 font-medium text-xs">
                                                    {(log.action_type || "unknown").replace(/_/g, " ")}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <code className="text-xs text-gray-500 font-mono">
                                                {log.campaign_id?.slice(0, 16) || "—"}
                                            </code>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {log.percentage_change != null ? (
                                                <span
                                                    className={`text-xs font-bold ${log.percentage_change > 0
                                                            ? "text-emerald-400"
                                                            : log.percentage_change < 0
                                                                ? "text-red-400"
                                                                : "text-gray-500"
                                                        }`}
                                                >
                                                    {log.percentage_change > 0 ? "+" : ""}
                                                    {log.percentage_change}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-700">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge status={log.status || "PENDING"} />
                                        </td>
                                        <td className="px-3 py-3 text-center text-xs text-gray-500">
                                            {log.decided_by || "—"}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <VerdictBadge verdict={log.outcome_verdict} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
