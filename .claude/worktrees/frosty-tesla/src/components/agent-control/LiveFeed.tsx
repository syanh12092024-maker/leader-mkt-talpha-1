"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useProject } from "@/app/agent-control/layout";

/* ─── Types ──────────────────────────────────────── */
interface FeedEvent {
    id: string;
    timestamp: string;
    agent: string;
    step: string;
    message: string;
    level: "info" | "warn" | "error" | "success";
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Safe UUID (works on HTTP, no Secure Context needed) ── */
const genId = (): string =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/* ── Level colors ── */
const LEVEL_STYLES: Record<string, { prefix: string; color: string }> = {
    info: { prefix: "INFO", color: "text-blue-400" },
    warn: { prefix: "WARN", color: "text-amber-400" },
    error: { prefix: "FAIL", color: "text-red-400" },
    success: { prefix: " OK ", color: "text-emerald-400" },
};

/* ─── Component ──────────────────────────────────── */
export default function LiveFeed() {
    const { projectId } = useProject();
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState<string>("all");
    const scrollRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 5;

    /* ── SSE Connection ── */
    const connect = useCallback(() => {
        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const url = `${API}/api/agent-feed/analyst/feed?project_id=${projectId}`;
        const es = new EventSource(url);

        // onopen moved below onerror for proper retry counter reset

        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                // Skip heartbeats
                if (data.type === "heartbeat") return;

                const event: FeedEvent = {
                    id: data.id || genId(),
                    timestamp: data.timestamp || new Date().toISOString(),
                    agent: data.agent || "system",
                    step: data.step || "",
                    message: data.message || data.data || JSON.stringify(data),
                    level: data.level || "info",
                };
                if (!paused) {
                    setEvents((prev) => [...prev.slice(-500), event]); // Keep max 500
                }
            } catch {
                // Ignore parse errors (heartbeats, etc.)
            }
        };

        es.onerror = () => {
            setConnected(false);
            retryCountRef.current += 1;
            if (retryCountRef.current >= MAX_RETRIES) {
                es.close();
                addSystemEvent(`Connection failed after ${MAX_RETRIES} retries. Click Reconnect to try again.`, "error");
            } else {
                addSystemEvent(`Connection lost. Retry ${retryCountRef.current}/${MAX_RETRIES}...`, "warn");
            }
        };

        es.onopen = () => {
            retryCountRef.current = 0;
            setConnected(true);
            addSystemEvent("Connected to agent feed", "success");
        };

        eventSourceRef.current = es;
    }, [projectId, paused]);

    const addSystemEvent = (message: string, level: FeedEvent["level"]) => {
        setEvents((prev) => [
            ...prev.slice(-500),
            {
                id: genId(),
                timestamp: new Date().toISOString(),
                agent: "system",
                step: "",
                message,
                level,
            },
        ]);
    };

    /* ── Auto-connect ── */
    useEffect(() => {
        connect();
        return () => {
            eventSourceRef.current?.close();
        };
    }, [connect]);

    /* ── Auto-scroll ── */
    useEffect(() => {
        if (!paused && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, paused]);

    /* ── Filtered events ── */
    const filteredEvents =
        filter === "all"
            ? events
            : events.filter((e) => e.level === filter);

    /* ── Format timestamp ── */
    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
        } catch {
            return "--:--:--";
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <span className="text-2xl">📡</span> Live Feed
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Real-time agent activity for{" "}
                        <span className="text-indigo-400 font-semibold">
                            {projectId.toUpperCase()}
                        </span>
                    </p>
                </div>

                {/* Status + Controls */}
                <div className="flex items-center gap-3">
                    {/* Connection indicator */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900/50 border border-gray-800/50">
                        <span
                            className={`w-2 h-2 rounded-full ${connected
                                ? "bg-emerald-500 animate-pulse"
                                : "bg-red-500"
                                }`}
                        />
                        <span className="text-xs text-gray-400">
                            {connected ? "Connected" : "Disconnected"}
                        </span>
                    </div>

                    {/* Filter */}
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-gray-900/50 border border-gray-800/50 rounded-lg px-2.5 py-1.5 text-xs text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                    >
                        <option value="all">All</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="success">Success</option>
                    </select>

                    {/* Pause/Resume */}
                    <button
                        onClick={() => setPaused(!paused)}
                        className={`
              px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${paused
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                : "bg-gray-900/50 border-gray-800/50 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                            }
            `}
                    >
                        {paused ? "▶ Resume" : "⏸ Pause"}
                    </button>

                    {/* Clear */}
                    <button
                        onClick={() => setEvents([])}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-800/50
                       hover:text-gray-300 hover:border-gray-600 transition-all"
                    >
                        🗑 Clear
                    </button>
                </div>
            </div>

            {/* ═══ TERMINAL ═══ */}
            <div className="rounded-xl border border-gray-800/60 bg-[#080c14] overflow-hidden">
                {/* ── Top bar (macOS-style) ── */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0d1220] border-b border-gray-800/40">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="text-xs text-gray-600 ml-3 font-mono">
                        faos@{projectId} ~ agent-feed
                    </span>
                    <span className="ml-auto text-[10px] text-gray-700 font-mono">
                        {filteredEvents.length} events
                    </span>
                </div>

                {/* ── Event log ── */}
                <div
                    ref={scrollRef}
                    className="h-[calc(100vh-280px)] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed
                     scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-800"
                >
                    {filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-700">
                            <p className="text-3xl mb-3">📡</p>
                            <p className="text-sm">Waiting for events...</p>
                            <p className="text-xs mt-1">
                                Agent activity will appear here in real-time
                            </p>
                        </div>
                    ) : (
                        filteredEvents.map((evt) => {
                            const style = LEVEL_STYLES[evt.level] || LEVEL_STYLES.info;
                            return (
                                <div
                                    key={evt.id}
                                    className="flex gap-2 hover:bg-gray-900/30 px-1 py-0.5 rounded group"
                                >
                                    {/* Timestamp */}
                                    <span className="text-gray-700 shrink-0 select-none">
                                        {formatTime(evt.timestamp)}
                                    </span>
                                    {/* Level badge */}
                                    <span
                                        className={`${style.color} shrink-0 font-bold select-none`}
                                    >
                                        [{style.prefix}]
                                    </span>
                                    {/* Agent */}
                                    {evt.agent && evt.agent !== "system" && (
                                        <span className="text-purple-500 shrink-0">
                                            {evt.agent}
                                        </span>
                                    )}
                                    {/* Step */}
                                    {evt.step && (
                                        <span className="text-gray-600 shrink-0">
                                            {evt.step}:
                                        </span>
                                    )}
                                    {/* Message */}
                                    <span className="text-gray-300">{evt.message}</span>
                                </div>
                            );
                        })
                    )}

                    {/* Cursor blink */}
                    {!paused && (
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-gray-700">$</span>
                            <span className="w-2 h-4 bg-indigo-500/70 animate-pulse" />
                        </div>
                    )}
                </div>
            </div>

            {/* Pause overlay */}
            {paused && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium flex items-center gap-2 z-50">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Feed paused — new events are buffered
                </div>
            )}
        </div>
    );
}
