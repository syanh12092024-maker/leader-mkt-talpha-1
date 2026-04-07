"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useProject } from "@/app/agent-control/layout";

/* ─── Types ──────────────────────────────────────── */
interface Lesson {
    id: string;
    category: string;
    text: string;
    confidence: number | null;
    created_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Category styles ── */
const CATEGORY_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
    roas: { icon: "📈", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    cpa: { icon: "💰", color: "text-amber-400", bg: "bg-amber-500/10" },
    budget: { icon: "💵", color: "text-blue-400", bg: "bg-blue-500/10" },
    creative: { icon: "🎨", color: "text-purple-400", bg: "bg-purple-500/10" },
    targeting: { icon: "🎯", color: "text-pink-400", bg: "bg-pink-500/10" },
    market: { icon: "🌍", color: "text-cyan-400", bg: "bg-cyan-500/10" },
    product: { icon: "📦", color: "text-orange-400", bg: "bg-orange-500/10" },
    general: { icon: "💡", color: "text-gray-400", bg: "bg-gray-500/10" },
};

const getCategoryStyle = (cat: string) =>
    CATEGORY_STYLES[cat?.toLowerCase()] || CATEGORY_STYLES.general;

/* ── Confidence bar ── */
const ConfidenceBar = ({ value }: { value: number | null }) => {
    const pct = value ?? 0;
    const color =
        pct >= 80
            ? "bg-emerald-500"
            : pct >= 60
                ? "bg-blue-500"
                : pct >= 40
                    ? "bg-amber-500"
                    : "bg-red-500";
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-[11px] text-gray-500 font-mono w-8 text-right">
                {pct}%
            </span>
        </div>
    );
};

/* ── Skeleton ── */
const CardSkeleton = () => (
    <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-5 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-800" />
            <div className="h-3 w-20 bg-gray-800 rounded" />
        </div>
        <div className="space-y-2">
            <div className="h-3 bg-gray-800/60 rounded w-full" />
            <div className="h-3 bg-gray-800/60 rounded w-3/4" />
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full w-full" />
    </div>
);

/* ─── Component ──────────────────────────────────── */
export default function MemoryManager() {
    const { projectId } = useProject();
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        msg: string;
    } | null>(null);

    /* ── Fetch ── */
    const fetchLessons = useCallback(async () => {
        setLoading(true);
        try {
            const url =
                filter === "all"
                    ? `${API}/api/ai-intelligence/lessons?project_id=${projectId}&limit=50`
                    : `${API}/api/ai-intelligence/lessons?project_id=${projectId}&category=${filter}&limit=50`;
            const res = await fetch(url);
            const json = await res.json();
            setLessons(Array.isArray(json) ? json : []);
        } catch {
            setLessons([]);
        } finally {
            setLoading(false);
        }
    }, [projectId, filter]);

    useEffect(() => {
        fetchLessons();
    }, [fetchLessons]);

    /* ── Delete ── */
    const handleDelete = async (lessonId: string) => {
        if (!confirm("Bạn chắc chắn muốn xóa bài học này? AI sẽ không còn nhớ nó.")) return;

        setDeleting(lessonId);
        // Optimistic update
        setLessons((prev) => prev.filter((l) => l.id !== lessonId));

        try {
            const res = await fetch(
                `${API}/api/memory/lessons/${lessonId}?project_id=${projectId}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
            showToast("success", "Đã xóa bài học");
        } catch {
            // Revert optimistic update
            await fetchLessons();
            showToast("error", "Xóa thất bại — đã khôi phục");
        } finally {
            setDeleting(null);
        }
    };

    const showToast = (type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    /* ── Unique categories from data ── */
    const categories = Array.from(new Set(lessons.map((l) => l.category?.toLowerCase()).filter(Boolean)));

    /* ── Stats ── */
    const avgConfidence =
        lessons.length > 0
            ? Math.round(
                lessons.reduce((sum, l) => sum + (l.confidence ?? 0), 0) / lessons.length
            )
            : 0;

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <span className="text-2xl">🧠</span> Memory Manager
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        AI learned lessons for{" "}
                        <span className="text-indigo-400 font-semibold">
                            {projectId.toUpperCase()}
                        </span>
                    </p>
                </div>
            </div>

            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-4">
                    <span className="text-xs text-gray-500 font-medium">Total Lessons</span>
                    <p className="text-2xl font-bold text-gray-100 mt-1">{lessons.length}</p>
                </div>
                <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-4">
                    <span className="text-xs text-gray-500 font-medium">Categories</span>
                    <p className="text-2xl font-bold text-indigo-400 mt-1">{categories.length}</p>
                </div>
                <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-4">
                    <span className="text-xs text-gray-500 font-medium">Avg Confidence</span>
                    <p className={`text-2xl font-bold mt-1 ${avgConfidence >= 70 ? "text-emerald-400" : avgConfidence >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>
                        {avgConfidence}%
                    </p>
                </div>
            </div>

            {/* ═══ FILTER BAR ═══ */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filter === "all"
                            ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                            : "bg-gray-900/30 text-gray-500 border-gray-800/50 hover:text-gray-300"
                        }`}
                >
                    All ({lessons.length})
                </button>
                {categories.map((cat) => {
                    const style = getCategoryStyle(cat);
                    const count = lessons.filter((l) => l.category?.toLowerCase() === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${filter === cat
                                    ? `${style.bg} ${style.color} border-current/30`
                                    : "bg-gray-900/30 text-gray-500 border-gray-800/50 hover:text-gray-300"
                                }`}
                        >
                            <span>{style.icon}</span>
                            <span className="capitalize">{cat}</span>
                            <span className="text-gray-600 ml-0.5">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* ═══ LESSONS GRID ═══ */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : lessons.length === 0 ? (
                <div className="rounded-xl border border-gray-800/60 bg-[#0d1220] p-16 text-center">
                    <p className="text-3xl mb-3">🧠</p>
                    <p className="text-sm text-gray-500">
                        No lessons learned yet for{" "}
                        <strong className="text-gray-400">{projectId.toUpperCase()}</strong>
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                        Lessons are generated after T+1 reflection runs
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lessons.map((lesson) => {
                        const catStyle = getCategoryStyle(lesson.category);
                        return (
                            <div
                                key={lesson.id}
                                className={`
                  rounded-xl border border-gray-800/60 bg-[#0d1220] p-5
                  hover:border-gray-700/60 transition-all group
                  ${deleting === lesson.id ? "opacity-40 scale-95" : ""}
                `}
                            >
                                {/* Top row: category + actions */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`w-8 h-8 rounded-lg ${catStyle.bg} flex items-center justify-center text-sm`}
                                        >
                                            {catStyle.icon}
                                        </span>
                                        <div>
                                            <span
                                                className={`text-[11px] font-semibold uppercase tracking-wider ${catStyle.color}`}
                                            >
                                                {lesson.category || "general"}
                                            </span>
                                            <p className="text-[10px] text-gray-700 font-mono">
                                                {lesson.created_at?.slice(0, 10) || "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(lesson.id)}
                                        disabled={deleting === lesson.id}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1
                               rounded-md text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10
                               disabled:opacity-30"
                                        title="Xóa bài học"
                                    >
                                        🗑️
                                    </button>
                                </div>

                                {/* Lesson text */}
                                <p className="text-sm text-gray-300 leading-relaxed mb-3">
                                    {lesson.text}
                                </p>

                                {/* Confidence bar */}
                                <div>
                                    <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
                                        Confidence
                                    </span>
                                    <ConfidenceBar value={lesson.confidence} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ TOAST ═══ */}
            {toast && (
                <div
                    className={`
            fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-sm font-medium z-[60]
            border shadow-lg
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
