"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Users, RefreshCw, CheckCircle2, XCircle, Loader2,
    ChevronDown, Search, CheckSquare, Square, MessageSquare,
    AlertTriangle, ShoppingBag, Phone, ExternalLink, ImagePlus, X,
    Clock, Timer, CalendarClock, Filter, History, RotateCcw, Trash2, Edit2
} from "lucide-react";

// ─── Timezone mapping ─────────────────────────────────────────────────────────
const SHOP_TIMEZONES: Record<string, { offset: number; label: string; flag: string }> = {
    "Saudi": { offset: 3, label: "Riyadh", flag: "🇸🇦" },
    "UAE": { offset: 4, label: "Dubai", flag: "🇦🇪" },
    "Kuwait": { offset: 3, label: "Kuwait City", flag: "🇰🇼" },
    "Oman": { offset: 4, label: "Muscat", flag: "🇴🇲" },
    "Qatar": { offset: 3, label: "Doha", flag: "🇶🇦" },
    "Bahrain": { offset: 3, label: "Manama", flag: "🇧🇭" },
    "Japan": { offset: 9, label: "Tokyo", flag: "🇯🇵" },
    "Taiwan": { offset: 8, label: "Taipei", flag: "🇹🇼" },
};

const SCHEDULE_HOURS = [6, 11, 17, 21];
const SCHEDULE_LABELS: Record<number, string> = {
    6: "🌅 Sáng sớm",
    11: "☀️ Trưa",
    17: "🌆 Chiều",
    21: "🌙 Tối",
};

function getNextScheduleTime(hour: number, utcOffset: number): Date {
    const now = new Date();
    // Current time in target timezone
    const targetNow = new Date(now.getTime() + utcOffset * 3600000 + now.getTimezoneOffset() * 60000);
    // Target time today in target timezone
    const target = new Date(targetNow);
    target.setHours(hour, 0, 0, 0);
    // If time already passed today, schedule for tomorrow
    if (target <= targetNow) {
        target.setDate(target.getDate() + 1);
    }
    // Convert back to local time
    const diff = target.getTime() - targetNow.getTime();
    return new Date(now.getTime() + diff);
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return "00:00:00";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getCurrentTimeInTimezone(utcOffset: number): string {
    const now = new Date();
    const target = new Date(now.getTime() + utcOffset * 3600000 + now.getTimezoneOffset() * 60000);
    return target.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Shop {
    name: string;
    shop_id: string;
}

interface PageInfo {
    pageId: string;
    name: string;
    platform: string;
}

interface Customer {
    id: string;
    customerName: string;
    customerPhone: string;
    fbId: string;
    psid: string;
    pageFbId: string;
    customerId: string;
    conversationLink: string;
    orderCount: number;
    messageCount: number;
    snippet: string;
    tags: string[] | number[];
    address: string;
    updatedAt: string;
    lastInteraction: string;
    source: "crm" | "pos";
}

interface SendResult {
    psid: string;
    name: string;
    success: boolean;
    error?: string;
}

interface BroadcastSchedule {
    id: string;
    shopId: string;
    shopName: string;
    pageId: string;
    pageName: string;
    hour: number;                   // 6 | 11 | 17 | 21
    messages: string[];             // [msg1, msg2, msg3, msg4]
    filterPurchase: string;
    filterTimeRange: string;
    isActive: boolean;              // true = running, false = paused
    createdAt: string;
    lastFiredAt: string | null;
    nextFireAt: string | null;      // ISO - next scheduled fire time
    note?: string;
}

const SCHEDULE_KEY = "broadcast_schedules_v1";

function loadSchedules(): BroadcastSchedule[] {
    try {
        const raw = localStorage.getItem(SCHEDULE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveSchedules(entries: BroadcastSchedule[]) {
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}

function calcNextFireAt(hour: number, utcOffset: number): string {
    const fireTime = getNextScheduleTime(hour, utcOffset);
    return fireTime.toISOString();
}

// ─── Box color config ─────────────────────────────────────────────────────────
const BOX_COLORS = [
    { border: "border-violet-300", bg: "bg-violet-50/40", label: "text-violet-700", inputBorder: "border-violet-200", ring: "focus:ring-violet-300/40" },
    { border: "border-blue-300", bg: "bg-blue-50/40", label: "text-blue-700", inputBorder: "border-blue-200", ring: "focus:ring-blue-300/40" },
    { border: "border-emerald-300", bg: "bg-emerald-50/40", label: "text-emerald-700", inputBorder: "border-emerald-200", ring: "focus:ring-emerald-300/40" },
    { border: "border-orange-300", bg: "bg-orange-50/40", label: "text-orange-700", inputBorder: "border-orange-200", ring: "focus:ring-orange-300/40" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BroadcastTab() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [selectedShopId, setSelectedShopId] = useState("");
    const [pages, setPages] = useState<PageInfo[]>([]);
    const [selectedPageId, setSelectedPageId] = useState("");
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [msg1, setMsg1] = useState("");
    const [msg2, setMsg2] = useState("");
    const [msg3, setMsg3] = useState("");
    const [msg4, setMsg4] = useState("");
    const [media1, setMedia1] = useState<string[]>([]);
    const [media2, setMedia2] = useState<string[]>([]);
    const [media3, setMedia3] = useState<string[]>([]);
    const [media4, setMedia4] = useState<string[]>([]);
    // Schedule states
    const [scheduledHour, setScheduledHour] = useState<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isLoadingShops, setIsLoadingShops] = useState(true);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState("");
    const [scheduleToast, setScheduleToast] = useState<string | null>(null);

    // Load schedules from localStorage on mount
    useEffect(() => {
        setSchedules(loadSchedules());
    }, []);

    // Recalculate nextFireAt for active schedules that are overdue
    useEffect(() => {
        setSchedules(prev => {
            const now = Date.now();
            let changed = false;
            const updated = prev.map(s => {
                if (s.isActive && s.nextFireAt && new Date(s.nextFireAt).getTime() < now - 86400000) {
                    changed = true;
                    const tz = SHOP_TIMEZONES[s.shopName]?.offset ?? 3;
                    return { ...s, nextFireAt: calcNextFireAt(s.hour, tz) };
                }
                return s;
            });
            if (changed) saveSchedules(updated);
            return changed ? updated : prev;
        });
    }, []);


    // Filter states
    const [filterPurchase, setFilterPurchase] = useState<'all' | 'no_purchase' | 'has_purchase'>('all');
    const [filterTimeRange, setFilterTimeRange] = useState<'all' | '24h' | '7d' | '30d' | '90d'>('all');
    const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
    const [filterActive, setFilterActive] = useState(false);
    const [pageSearch, setPageSearch] = useState("");
    const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);

    // Load shops
    useEffect(() => {
        fetch("/api/broadcast")
            .then((r) => r.json())
            .then((data) => { if (data.shops) setShops(data.shops); })
            .catch(console.error)
            .finally(() => setIsLoadingShops(false));
    }, []);

    // Load pages when shop changes
    const loadPages = useCallback(async (shopId: string) => {
        if (!shopId) {
            setPages([]);
            setSelectedPageId("");
            return;
        }
        setIsLoadingPages(true);
        setPages([]);
        setSelectedPageId("");
        setCustomers([]);

        try {
            const res = await fetch(`/api/broadcast?shopId=${shopId}&getPages=true`);
            const data = await res.json();
            if (data.pages) {
                setPages(data.pages);
            }
        } catch (err) {
            console.error("Load pages error:", err);
        } finally {
            setIsLoadingPages(false);
        }
    }, []);

    // Load customers (with optional page filter)
    const loadCustomers = async () => {
        if (!selectedShopId) return;
        setIsLoadingCustomers(true);
        setSelectedIds(new Set());

        try {
            let url = `/api/broadcast?shopId=${selectedShopId}&page=${currentPage}`;
            if (selectedPageId) url += `&pageFilter=${encodeURIComponent(selectedPageId)}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.customers) {
                setCustomers(data.customers);
                setTotalCustomers(data.total || data.customers.length);
                setTotalPages(data.totalPages || 1);
                setCurrentPage(data.page || currentPage);
            } else if (data.error) {
                console.error("Load customers error:", data.error);
                setCustomers([]);
            }
        } catch (err) {
            console.error("Load customers error:", err);
            setCustomers([]);
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ─── Filter logic ─────────────────────────────────────────────
    const filteredCustomers = useMemo(() => {
        if (!filterActive) return customers;
        let result = customers;

        if (filterPurchase === 'no_purchase') {
            result = result.filter(c => !c.customerPhone && c.orderCount === 0);
        } else if (filterPurchase === 'has_purchase') {
            result = result.filter(c => c.customerPhone || c.orderCount > 0);
        }

        if (filterTimeRange !== 'all') {
            const now = Date.now();
            const msMap: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
            const cutoff = now - (msMap[filterTimeRange] || 0);
            result = result.filter(c => {
                const t = new Date(c.lastInteraction || c.updatedAt).getTime();
                return t >= cutoff;
            });
        }

        return result;
    }, [customers, filterPurchase, filterTimeRange, filterActive]);

    const toggleAll = () => {
        if (selectedIds.size === filteredCustomers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
        }
    };

    const toggleCustomer = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Combine 4 message boxes
    const messages = [msg1, msg2, msg3, msg4];
    const mediaArrays = [media1, media2, media3, media4];
    const setMediaArrays = [setMedia1, setMedia2, setMedia3, setMedia4];
    const setMessages = [setMsg1, setMsg2, setMsg3, setMsg4];
    const totalMediaCount = media1.length + media2.length + media3.length + media4.length;

    const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, boxIdx: number) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const setter = setMediaArrays[boxIdx];
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                setter(prev => [...prev, dataUrl]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeMedia = (boxIdx: number, mediaIdx: number) => {
        setMediaArrays[boxIdx](prev => prev.filter((_, i) => i !== mediaIdx));
    };

    // Get shop timezone
    const shopName = shops.find(s => s.shop_id === selectedShopId)?.name || "";
    const shopTz = SHOP_TIMEZONES[shopName] || { offset: 3, label: "UTC+3", flag: "🌍" };

    // ─── New: handleSchedule saves a daily recurring schedule ──────────
    const handleSchedule = (hour: number) => {
        if (!selectedShopId || selectedIds.size === 0) return;
        const pageName = pages.find(p => p.pageId === selectedPageId)?.name || "Tất cả pages";

        // Check if exact same shop+page+hour already exists → update messages
        const existing = schedules.find(s => s.shopId === selectedShopId && s.pageId === selectedPageId && s.hour === hour);
        const nextFireAt = calcNextFireAt(hour, shopTz.offset);

        if (existing) {
            const updated = schedules.map(s => s.id === existing.id
                ? { ...s, messages: [msg1, msg2, msg3, msg4], filterPurchase, filterTimeRange, nextFireAt, isActive: true }
                : s);
            setSchedules(updated);
            saveSchedules(updated);
            setScheduleToast(`✅ Đã cập nhật lịch ${hour}:00 cho ${pageName}`);
        } else {
            const entry: BroadcastSchedule = {
                id: `${Date.now()}`,
                shopId: selectedShopId,
                shopName,
                pageId: selectedPageId,
                pageName,
                hour,
                messages: [msg1, msg2, msg3, msg4],
                filterPurchase,
                filterTimeRange,
                isActive: true,
                createdAt: new Date().toISOString(),
                lastFiredAt: null,
                nextFireAt,
            };
            const updated = [entry, ...schedules];
            setSchedules(updated);
            saveSchedules(updated);
            setScheduleToast(`✅ Đã lên lịch bắn ${hour}:00 hàng ngày cho ${pageName}`);
        }
        setScheduledHour(hour);
        setTimeout(() => setScheduleToast(null), 3000);
    };

    // ─── Auto-fire: check every 30s ──────────────────────────────────────
    const sendForSchedule = useCallback(async (s: BroadcastSchedule) => {
        const msg = s.messages[0]?.trim();
        if (!msg) return;
        try {
            // Load customers for this schedule
            const url = `/api/broadcast?shopId=${s.shopId}&page=1${s.pageId ? `&pageFilter=${encodeURIComponent(s.pageId)}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!data.customers?.length) return;

            let recipients = data.customers as Customer[];
            if (s.filterPurchase === 'no_purchase') recipients = recipients.filter((c: Customer) => !c.customerPhone && c.orderCount === 0);
            if (s.filterPurchase === 'has_purchase') recipients = recipients.filter((c: Customer) => c.customerPhone || c.orderCount > 0);

            const payload = {
                recipients: recipients.map((c: Customer) => ({ psid: c.psid, pageFbId: c.pageFbId, name: c.customerName, conversationId: c.id })),
                message: msg,
            };
            await fetch('/api/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

            // Update lastFiredAt and nextFireAt (+1 day)
            const tz = SHOP_TIMEZONES[s.shopName]?.offset ?? 3;
            const nextFire = new Date(getNextScheduleTime(s.hour, tz).getTime() + 86400000);
            setSchedules(prev => {
                const updated = prev.map(x => x.id === s.id ? { ...x, lastFiredAt: new Date().toISOString(), nextFireAt: nextFire.toISOString() } : x);
                saveSchedules(updated);
                return updated;
            });
        } catch (err) { console.error('Auto-fire error:', err); }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setSchedules(prev => {
                prev.forEach(s => {
                    if (s.isActive && s.nextFireAt && new Date(s.nextFireAt).getTime() <= now) {
                        sendForSchedule(s);
                    }
                });
                return prev;
            });
        }, 30000);
        return () => clearInterval(interval);
    }, [sendForSchedule]);


    // Filter pages by search
    const filteredPages = pages.filter((p) => {
        if (!pageSearch.trim()) return true;
        const q = pageSearch.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.pageId.includes(q);
    });

    // Get selected page name
    const selectedPageName = pages.find((p) => p.pageId === selectedPageId)?.name || "";

    // Time formatter
    const formatTime = (iso: string) => {
        if (!iso) return "";
        try {
            const d = new Date(iso);
            return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
        } catch { return iso; }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📩</span> Gửi Tin Nhắn Hàng Loạt
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Lấy khách từ Pancake POS · Gửi tin tự động hàng ngày qua Facebook Messenger
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    HUMAN_AGENT tag · 7 ngày
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-end gap-2 flex-wrap">

                {/* Shop */}
                <div className="flex-shrink-0">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">🏪 Chọn Shop</label>
                    <div className="relative w-40">
                        <select
                            value={selectedShopId}
                            onChange={(e) => { setSelectedShopId(e.target.value); loadPages(e.target.value); }}
                            disabled={isLoadingShops}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm truncate"
                        >
                            <option value="">— Chọn shop —</option>
                            {shops.map((s) => (
                                <option key={s.shop_id} value={s.shop_id}>{s.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Page Selector */}
                <div className="relative flex-1 min-w-[180px]">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">
                        📄 Chọn Page {pages.length > 0 && <span className="text-violet-500">({pages.length} pages)</span>}
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                        <input
                            type="text"
                            value={isPageDropdownOpen ? pageSearch : (selectedPageId ? `${selectedPageName} (${selectedPageId})` : "")}
                            onChange={(e) => { setPageSearch(e.target.value); if (!isPageDropdownOpen) setIsPageDropdownOpen(true); }}
                            onFocus={() => { setIsPageDropdownOpen(true); setPageSearch(""); }}
                            placeholder={isLoadingPages ? "Đang tải pages..." : "Tìm page theo tên hoặc ID..."}
                            disabled={!selectedShopId || isLoadingPages}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                        />
                        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-transform ${isPageDropdownOpen ? "rotate-180" : ""}`} />
                        {isLoadingPages && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-violet-400 animate-spin" />}
                    </div>
                    {isPageDropdownOpen && pages.length > 0 && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsPageDropdownOpen(false)} />
                            <div className="absolute z-30 top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-xl max-h-[280px] overflow-y-auto">
                                <button
                                    onClick={() => { setSelectedPageId(""); setIsPageDropdownOpen(false); setPageSearch(""); setCustomers([]); setSelectedIds(new Set()); setFilterActive(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors border-b border-slate-100 ${!selectedPageId ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-600"}`}
                                >
                                    Tất cả pages ({pages.length})
                                </button>
                                {filteredPages.map((p) => (
                                    <button
                                        key={p.pageId}
                                        onClick={() => { setSelectedPageId(p.pageId); setIsPageDropdownOpen(false); setPageSearch(""); setCustomers([]); setSelectedIds(new Set()); setFilterActive(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-0 ${selectedPageId === p.pageId ? "bg-violet-50" : ""}`}
                                    >
                                        <div className={`font-medium truncate ${selectedPageId === p.pageId ? "text-violet-700" : "text-slate-700"}`}>{p.name}</div>
                                        <div className="text-[10px] text-slate-400">{p.pageId}</div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Purchase filter */}
                <div className="flex-shrink-0">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">🛍 Trạng thái</label>
                    <select
                        value={filterPurchase}
                        onChange={(e) => setFilterPurchase(e.target.value as 'all' | 'no_purchase' | 'has_purchase')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                    >
                        <option value="all">Tất cả</option>
                        <option value="no_purchase">Chưa mua</option>
                        <option value="has_purchase">Đã mua</option>
                    </select>
                </div>

                {/* Time range filter */}
                <div className="flex-shrink-0">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">📅 Thời gian</label>
                    <select
                        value={filterTimeRange}
                        onChange={(e) => setFilterTimeRange(e.target.value as 'all' | '24h' | '7d' | '30d' | '90d')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-400/30 shadow-sm"
                    >
                        <option value="all">Tất cả</option>
                        <option value="24h">24 giờ qua</option>
                        <option value="7d">7 ngày qua</option>
                        <option value="30d">30 ngày qua</option>
                        <option value="90d">90 ngày qua</option>
                    </select>
                </div>

                {/* Filter Button */}
                <button
                    onClick={async () => { await loadCustomers(); setFilterActive(true); }}
                    disabled={!selectedShopId || isLoadingCustomers}
                    className="flex-shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoadingCustomers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                    Lọc data
                </button>

                {/* Refresh */}
                <button
                    onClick={async () => { await loadCustomers(); setFilterActive(true); }}
                    disabled={!selectedShopId || isLoadingCustomers}
                    className="flex-shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 hover:bg-slate-50 disabled:opacity-40 shadow-sm"
                >
                    <RefreshCw className={`h-4 w-4 text-slate-500 ${isLoadingCustomers ? "animate-spin" : ""}`} />
                </button>

                {/* Customer count */}
                {filteredCustomers.length > 0 && (
                    <div className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                        <Users className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">{filteredCustomers.length}/{customers.length}</span>
                    </div>
                )}
            </div>

            {/* Customer list (chỉ hiện khi đã lọc) */}
            {customers.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Select all bar */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                        <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-700 transition-colors">
                            {selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0
                                ? <CheckSquare className="h-4 w-4 text-violet-600" />
                                : <Square className="h-4 w-4 text-slate-400" />
                            }
                            <span className="font-medium">
                                {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size}/${filteredCustomers.length}` : `Chọn tất cả (${filteredCustomers.length})`}
                            </span>
                        </button>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 ml-auto">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded-lg text-xs border border-slate-200 hover:bg-slate-50 disabled:opacity-40">‹</button>
                                <span className="text-xs text-slate-500">{currentPage}/{totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded-lg text-xs border border-slate-200 hover:bg-slate-50 disabled:opacity-40">›</button>
                            </div>
                        )}
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
                        {filteredCustomers.map((c) => {
                            const checked = selectedIds.has(c.id);
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => toggleCustomer(c.id)}
                                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${checked ? "bg-violet-50/40" : ""}`}
                                >
                                    {checked ? <CheckSquare className="h-4 w-4 text-violet-500 flex-shrink-0" /> : <Square className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-700 truncate">{c.customerName || "—"}</span>
                                            {c.customerPhone && <Phone className="h-3 w-3 text-green-500 flex-shrink-0" />}
                                            {c.orderCount > 0 && <ShoppingBag className="h-3 w-3 text-violet-400 flex-shrink-0" />}
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate">{c.snippet || "Không có tin nhắn"}</p>
                                    </div>
                                    <a href={c.conversationLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-shrink-0 text-slate-300 hover:text-violet-500 transition-colors">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Message boxes */}
            <div className="grid grid-cols-1 gap-3">
                {BOX_COLORS.map((c, boxIdx) => {
                    const msg = messages[boxIdx];
                    const setMsg = setMessages[boxIdx];
                    const boxMedia = mediaArrays[boxIdx];
                    const setMedia = setMediaArrays[boxIdx];
                    const hasContent = msg.trim() || boxMedia.length > 0;
                    return (
                        <div key={boxIdx} className={`rounded-xl border-2 ${c.border} ${c.bg} p-3 space-y-2`}>
                            <div className="flex items-center justify-between">
                                <label className={`text-[11px] font-semibold ${c.label} flex items-center gap-1`}>
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Đoạn {boxIdx + 1}
                                    {hasContent && <span className="ml-1 text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✓</span>}
                                </label>
                                <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] ${c.label} hover:opacity-80 transition-opacity`}>
                                    <ImagePlus className="h-3.5 w-3.5" />
                                    Thêm ảnh
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleMediaUpload(e, boxIdx)} />
                                </label>
                            </div>
                            {boxMedia.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {boxMedia.map((src, mi) => (
                                        <div key={mi} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                                            <img src={src} alt="" className="w-full h-full object-cover" />
                                            <button onClick={() => removeMedia(boxIdx, mi)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                                                <X className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <textarea
                                    value={msg}
                                    onChange={(e) => setMsg(e.target.value)}
                                    placeholder={`Nội dung đoạn ${boxIdx + 1}...`}
                                    rows={3}
                                    className={`flex-1 min-w-0 rounded-lg border ${c.inputBorder} bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 ${c.ring} resize-none`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ⏰ Schedule Timer - redesigned as "create schedule" */}
            <div className="rounded-lg border border-amber-100 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        Hẹn giờ bắn bot · {shopTz.flag} {shopName || "—"} ({shopTz.label}, UTC+{shopTz.offset})
                    </label>
                    <span className="text-[10px] text-amber-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Giờ hiện tại: {getCurrentTimeInTimezone(shopTz.offset)}
                    </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {SCHEDULE_HOURS.map((hour) => {
                        const isActive = scheduledHour === hour;
                        const alreadyScheduled = schedules.some(s => s.shopId === selectedShopId && s.pageId === selectedPageId && s.hour === hour && s.isActive);
                        return (
                            <button
                                key={hour}
                                onClick={() => handleSchedule(hour)}
                                disabled={!selectedShopId || selectedIds.size === 0 || messages.every(m => !m?.trim())}
                                className={`relative rounded-lg px-3 py-2.5 text-center transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                                    isActive || alreadyScheduled
                                        ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200"
                                        : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-700"
                                }`}
                            >
                                <div className="text-lg font-bold">{hour}:00</div>
                                <div className={`text-[10px] ${isActive || alreadyScheduled ? "text-amber-100" : "text-slate-400"}`}>
                                    {SCHEDULE_LABELS[hour]}
                                </div>
                                {alreadyScheduled && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
                                        <Timer className="h-2.5 w-2.5 text-white" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Toast feedback */}
                <AnimatePresence>
                    {scheduleToast && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                        >
                            {scheduleToast}
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="text-[10px] text-amber-500 text-center">
                    💡 Bấm giờ để lên lịch bắn hàng ngày · Tab phải mở để bắn tự động
                </p>
            </div>

            {/* ═══ DANH SÁCH LỊCH BẮN BOT ═══ */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-violet-500" />
                        <span className="text-sm font-semibold text-slate-700">Danh sách lịch bắn</span>
                        {schedules.length > 0 && (
                            <span className="text-[10px] bg-violet-100 text-violet-600 font-semibold px-2 py-0.5 rounded-full">
                                {schedules.filter(s => s.isActive).length} đang chạy
                            </span>
                        )}
                    </div>
                    {schedules.length > 0 && (
                        <button
                            onClick={() => { if (confirm("Xoá tất cả lịch bắn?")) { setSchedules([]); saveSchedules([]); } }}
                            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Xoá tất cả
                        </button>
                    )}
                </div>

                {schedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <CalendarClock className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">Chưa có lịch bắn nào</p>
                        <p className="text-xs mt-1">Chọn giờ bắn phía trên để tạo lịch tự động hàng ngày</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                        {schedules.map((s) => {
                            const nextFire = s.nextFireAt ? new Date(s.nextFireAt) : null;
                            const lastFire = s.lastFiredAt ? new Date(s.lastFiredAt) : null;
                            const isEditing = editingScheduleId === s.id;
                            const msUntilFire = nextFire ? nextFire.getTime() - Date.now() : 0;
                            const hoursLeft = msUntilFire > 0 ? Math.floor(msUntilFire / 3600000) : 0;
                            const minsLeft = msUntilFire > 0 ? Math.floor((msUntilFire % 3600000) / 60000) : 0;

                            return (
                                <div key={s.id} className={`px-4 py-3 hover:bg-slate-50/60 transition-colors ${!s.isActive ? "opacity-60" : ""}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Left: info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Status dot */}
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
                                                <span className="text-sm font-semibold text-slate-800">{s.hour}:00</span>
                                                <span className="text-[11px] text-slate-400">{SCHEDULE_LABELS[s.hour]}</span>
                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[120px]">{s.shopName}</span>
                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 truncate max-w-[180px]">{s.pageName}</span>
                                            </div>

                                            {/* Next fire */}
                                            {s.isActive && nextFire && msUntilFire > 0 && (
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <Timer className="h-3.5 w-3.5 text-amber-500" />
                                                    <span className="text-[11px] text-amber-700 font-semibold">
                                                        Bắn sau: {hoursLeft}h {minsLeft}m
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        ({nextFire.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ngày {nextFire.toLocaleDateString("vi-VN")})
                                                    </span>
                                                </div>
                                            )}
                                            {lastFire && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    Lần cuối: {lastFire.toLocaleString("vi-VN")}
                                                </p>
                                            )}

                                            {/* Messages preview */}
                                            {s.messages.some(m => m?.trim()) && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {s.messages.map((m, i) => m?.trim() ? (
                                                        <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded max-w-[200px] truncate">
                                                            Đoạn {i + 1}: {m.trim().slice(0, 35)}{m.trim().length > 35 ? "..." : ""}
                                                        </span>
                                                    ) : null)}
                                                </div>
                                            )}

                                            {/* Edit note */}
                                            {isEditing ? (
                                                <div className="mt-2 flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editNote}
                                                        onChange={e => setEditNote(e.target.value)}
                                                        placeholder="Ghi chú..."
                                                        className="flex-1 text-xs border border-violet-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200"
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") {
                                                                const updated = schedules.map(x => x.id === s.id ? { ...x, note: editNote } : x);
                                                                setSchedules(updated); saveSchedules(updated); setEditingScheduleId(null);
                                                            }
                                                            if (e.key === "Escape") setEditingScheduleId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => { const updated = schedules.map(x => x.id === s.id ? { ...x, note: editNote } : x); setSchedules(updated); saveSchedules(updated); setEditingScheduleId(null); }} className="text-[11px] bg-violet-500 text-white px-3 py-1 rounded-lg hover:bg-violet-600">Lưu</button>
                                                    <button onClick={() => setEditingScheduleId(null)} className="text-[11px] text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100">Huỷ</button>
                                                </div>
                                            ) : s.note ? (
                                                <p className="text-[11px] text-slate-500 mt-0.5 italic">📝 {s.note}</p>
                                            ) : null}
                                        </div>

                                        {/* Right: actions */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {/* Tạm dừng / Tiếp tục */}
                                            <button
                                                onClick={() => {
                                                    const updated = schedules.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x);
                                                    setSchedules(updated); saveSchedules(updated);
                                                }}
                                                title={s.isActive ? "Tạm dừng" : "Tiếp tục"}
                                                className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${s.isActive ? "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`}
                                            >
                                                {s.isActive ? <><span>⏸</span> Dừng</> : <><span>▶</span> Chạy</>}
                                            </button>
                                            {/* Chỉnh sửa ghi chú */}
                                            <button
                                                onClick={() => { setEditingScheduleId(s.id); setEditNote(s.note || ""); }}
                                                title="Chỉnh sửa ghi chú"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            {/* Dùng lại tin nhắn */}
                                            <button
                                                onClick={() => { const [m1, m2, m3, m4] = s.messages; setMsg1(m1 || ""); setMsg2(m2 || ""); setMsg3(m3 || ""); setMsg4(m4 || ""); }}
                                                title="Load lại tin nhắn"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            </button>
                                            {/* Xoá */}
                                            <button
                                                onClick={() => { const updated = schedules.filter(x => x.id !== s.id); setSchedules(updated); saveSchedules(updated); }}
                                                title="Xoá lịch này"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

