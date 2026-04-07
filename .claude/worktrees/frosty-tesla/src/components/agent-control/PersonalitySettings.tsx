"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useProject } from "@/app/agent-control/layout";

/* ─── Types ──────────────────────────────────────── */
interface PersonalityConfig {
    risk_level: number;
    auto_budget_limit: number;
    daily_auto_ceiling: number;
    [key: string]: unknown;
}

interface AdAccount {
    account_id: string;
    account_name: string;
    managed_by: "AI" | "HUMAN";
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Component ──────────────────────────────────── */
export default function PersonalitySettings() {
    const { projectId } = useProject();
    const [config, setConfig] = useState<PersonalityConfig>({
        risk_level: 0.5,
        auto_budget_limit: 5000,
        daily_auto_ceiling: 20000,
    });
    const [accounts, setAccounts] = useState<AdAccount[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    /* ── Fetch personality + accounts ── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, aRes] = await Promise.all([
                fetch(`${API}/api/personality/?project_id=${projectId}`),
                fetch(`${API}/api/personality/${projectId}/accounts`),
            ]);
            const pData = await pRes.json();
            const aData = await aRes.json();
            setConfig({
                risk_level: pData.risk_level ?? 0.5,
                auto_budget_limit: pData.auto_budget_limit ?? 5000,
                daily_auto_ceiling: pData.daily_auto_ceiling ?? 20000,
            });
            setAccounts(aData.accounts || []);
            setDirty(false);
        } catch {
            showToast("error", "Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ── Handlers ── */
    const updateConfig = (key: string, value: number) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setDirty(true);
    };

    const toggleAccount = (accountId: string) => {
        setAccounts((prev) =>
            prev.map((a) =>
                a.account_id === accountId
                    ? { ...a, managed_by: a.managed_by === "AI" ? "HUMAN" : "AI" }
                    : a
            )
        );
        setDirty(true);
    };

    const showToast = (type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save personality
            await fetch(`${API}/api/personality/?project_id=${projectId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            // Save delegation
            if (accounts.length > 0) {
                await fetch(`${API}/api/personality/${projectId}/accounts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(accounts),
                });
            }
            setDirty(false);
            showToast("success", `Saved settings for ${projectId.toUpperCase()}`);
        } catch {
            showToast("error", "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    /* ── Risk Level Label ── */
    const riskLabel = (v: number) =>
        v < 0.3
            ? "Conservative"
            : v < 0.6
                ? "Balanced"
                : v < 0.8
                    ? "Aggressive"
                    : "Maximum Risk";
    const riskColor = (v: number) =>
        v < 0.3
            ? "text-emerald-400"
            : v < 0.6
                ? "text-blue-400"
                : v < 0.8
                    ? "text-amber-400"
                    : "text-red-400";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-sm">Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div>
                <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                    <span className="text-2xl">⚙️</span> Personality Settings
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Configure AI behavior and ad account permissions for{" "}
                    <span className="text-indigo-400 font-semibold">
                        {projectId.toUpperCase()}
                    </span>
                </p>
            </div>

            {/* ═══ SECTION 1: PERSONALITY CONFIG ═══ */}
            <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-800/60 bg-gray-900/30">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center text-[10px]">
                            🎛️
                        </span>
                        AI Behavior Parameters
                    </h3>
                </div>
                <div className="p-5 space-y-6">
                    {/* — Risk Level Slider — */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">
                                Risk Level
                            </label>
                            <span
                                className={`text-sm font-semibold ${riskColor(config.risk_level)}`}
                            >
                                {(config.risk_level * 100).toFixed(0)}% — {riskLabel(config.risk_level)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={config.risk_level}
                            onChange={(e) =>
                                updateConfig("risk_level", parseFloat(e.target.value))
                            }
                            className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500
                         [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/30
                         [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing"
                        />
                        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                            <span>Conservative</span>
                            <span>Balanced</span>
                            <span>Aggressive</span>
                        </div>
                    </div>

                    {/* — Auto Budget Limit — */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-1.5">
                                Auto Budget Limit (¢)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.auto_budget_limit}
                                    onChange={(e) =>
                                        updateConfig("auto_budget_limit", parseInt(e.target.value) || 0)
                                    }
                                    className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                    ≈ ${(config.auto_budget_limit / 100).toFixed(0)}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-1">
                                Max auto-exec per single decision
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-300 block mb-1.5">
                                Daily Auto Ceiling (¢)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.daily_auto_ceiling}
                                    onChange={(e) =>
                                        updateConfig(
                                            "daily_auto_ceiling",
                                            parseInt(e.target.value) || 0
                                        )
                                    }
                                    className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                    ≈ ${(config.daily_auto_ceiling / 100).toFixed(0)}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-1">
                                Max total auto-exec budget per day
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 2: DELEGATION MATRIX ═══ */}
            <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-800/60 bg-gray-900/30 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-[10px]">
                            🛡️
                        </span>
                        AI Delegation Matrix
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-indigo-400">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            {accounts.filter((a) => a.managed_by === "AI").length} AI
                        </span>
                        <span className="flex items-center gap-1 text-amber-400">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            {accounts.filter((a) => a.managed_by === "HUMAN").length} Human
                        </span>
                    </div>
                </div>

                {accounts.length === 0 ? (
                    <div className="p-10 text-center text-gray-600">
                        <p className="text-2xl mb-2">📭</p>
                        <p className="text-sm">
                            No ad accounts configured for{" "}
                            <strong className="text-gray-400">
                                {projectId.toUpperCase()}
                            </strong>
                        </p>
                        <p className="text-xs mt-1 text-gray-700">
                            Add accounts via API or seed data
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800/40">
                        {/* — Table Header — */}
                        <div className="grid grid-cols-12 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600 bg-gray-900/20">
                            <div className="col-span-4">Account</div>
                            <div className="col-span-3">ID</div>
                            <div className="col-span-3 text-center">Control</div>
                            <div className="col-span-2 text-center">Status</div>
                        </div>

                        {/* — Account Rows — */}
                        {accounts.map((acct) => (
                            <div
                                key={acct.account_id}
                                className="grid grid-cols-12 items-center px-5 py-3 hover:bg-gray-800/20 transition-colors"
                            >
                                <div className="col-span-4">
                                    <p className="text-sm font-medium text-gray-200">
                                        {acct.account_name || acct.account_id}
                                    </p>
                                </div>
                                <div className="col-span-3">
                                    <code className="text-xs text-gray-500 font-mono">
                                        {acct.account_id}
                                    </code>
                                </div>
                                <div className="col-span-3 flex justify-center">
                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => toggleAccount(acct.account_id)}
                                        className={`
                      relative w-14 h-7 rounded-full transition-all duration-300 ease-in-out
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                      ${acct.managed_by === "AI" ? "bg-indigo-600" : "bg-gray-700"}
                    `}
                                    >
                                        {/* Thumb */}
                                        <span
                                            className={`
                        absolute top-1 w-5 h-5 rounded-full bg-white shadow-md
                        transition-all duration-300 ease-in-out flex items-center justify-center text-[10px]
                        ${acct.managed_by === "AI" ? "left-8" : "left-1"}
                      `}
                                        >
                                            {acct.managed_by === "AI" ? "🤖" : "🧑"}
                                        </span>
                                    </button>
                                </div>
                                <div className="col-span-2 flex justify-center">
                                    <span
                                        className={`
                      px-2.5 py-1 rounded-md text-[11px] font-semibold
                      ${acct.managed_by === "AI"
                                                ? "bg-indigo-500/15 text-indigo-400"
                                                : "bg-amber-500/15 text-amber-400"
                                            }
                    `}
                                    >
                                        {acct.managed_by === "AI" ? "AI Managed" : "Human Only"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ═══ SAVE BAR ═══ */}
            {dirty && (
                <div className="fixed bottom-0 left-64 right-0 px-6 py-3 bg-[#0d1220]/95 backdrop-blur-md border-t border-gray-800/60 flex items-center justify-end gap-4 z-50">
                    <span className="text-xs text-amber-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Unsaved changes
                    </span>
                    <button
                        onClick={() => fetchData()}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`
              px-5 py-2 rounded-lg text-sm font-semibold text-white
              bg-gradient-to-r from-indigo-600 to-purple-600
              hover:from-indigo-500 hover:to-purple-500
              shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30
              transition-all duration-200
              ${saving ? "opacity-60 cursor-not-allowed" : ""}
            `}
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            "💾 Save Changes"
                        )}
                    </button>
                </div>
            )}

            {/* ═══ TOAST ═══ */}
            {toast && (
                <div
                    className={`
            fixed bottom-16 right-6 px-4 py-2.5 rounded-lg text-sm font-medium z-[60]
            border shadow-lg animate-in slide-in-from-right-5 fade-in duration-300
            ${toast.type === "success"
                            ? "bg-emerald-900/90 border-emerald-700/50 text-emerald-200"
                            : "bg-red-900/90 border-red-700/50 text-red-200"
                        }
          `}
                >
                    {toast.type === "success" ? "✅" : "❌"} {toast.msg}
                </div>
            )}
        </div>
    );
}
