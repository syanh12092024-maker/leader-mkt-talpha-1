"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Users, RefreshCw, CheckCircle2, XCircle, Loader2,
    ChevronDown, Search, CheckSquare, Square, MessageSquare,
    AlertTriangle, ShoppingBag, Phone, ExternalLink, ImagePlus, X,
    Clock, Timer, CalendarClock, Filter
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

// ─── Schedule types + localStorage ───────────────────────────────────────────
interface BroadcastSchedule {
    id: string;
    shopId: string;
    shopName: string;
    pageId: string;
    pageName: string;
    hour: number;
    messages: string[];
    filterPurchase: string;
    filterTimeRange: string;
    isActive: boolean;
    createdAt: string;
    lastFiredAt: string | null;
    nextFireAt: string | null;
    note?: string;
    lastSegmentIndex?: number; // Track which segment was last sent (0-3)
}

const SCHEDULE_KEY = "broadcast_schedules_v2";

function loadSchedules(): BroadcastSchedule[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || "[]"); }
    catch { return []; }
}

function saveSchedules(list: BroadcastSchedule[]) {
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function calcNextFireAt(hour: number, utcOffset: number): string {
    return getNextScheduleTime(hour, utcOffset).toISOString();
}

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
    const [scheduleFireTime, setScheduleFireTime] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState("");
    const [isPaused, setIsPaused] = useState(false);
    const [remainingMs, setRemainingMs] = useState(0);
    const scheduleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isLoadingShops, setIsLoadingShops] = useState(true);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filter states
    const [filterPurchase, setFilterPurchase] = useState<'all' | 'no_purchase' | 'has_purchase'>('all');
    const [filterTimeRange, setFilterTimeRange] = useState<'all' | '24h' | '7d' | '30d' | '90d'>('all');
    const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
    const [filterActive, setFilterActive] = useState(false);
    const [pageSearch, setPageSearch] = useState("");
    const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);

    // ─── Schedule states ──────────────────────────────────────────────────────
    const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState("");
    const [scheduleToast, setScheduleToast] = useState<string | null>(null);
    const sendingRef = useRef<Set<string>>(new Set());

    // Load schedules from localStorage on mount
    useEffect(() => { setSchedules(loadSchedules()); }, []);

    // Auto-fire: check every 30 seconds — CHỈ GỬI 1 ĐOẠN/NGÀY, cycle qua segments
    // ⛔ TẠM DỪNG BẮN BOT – disabled 2026-03-23
    useEffect(() => {
        const tick = async () => {
            return; // ⛔ PAUSED – xóa dòng này để bật lại
            const now = Date.now();
            const list = loadSchedules();
            for (const s of list) {
                if (!s.isActive || !s.nextFireAt) continue;
                if (new Date(s.nextFireAt).getTime() > now) continue;
                if (sendingRef.current.has(s.id)) continue;
                sendingRef.current.add(s.id);
                try {
                    const url = `/api/broadcast?shopId=${s.shopId}&page=1${s.pageId ? `&pageFilter=${encodeURIComponent(s.pageId)}` : ""}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (!data.customers?.length) continue;
                    let recips: Customer[] = data.customers;
                    if (s.filterPurchase === "no_purchase") recips = recips.filter((c: Customer) => !c.customerPhone && c.orderCount === 0);
                    if (s.filterPurchase === "has_purchase") recips = recips.filter((c: Customer) => c.customerPhone || c.orderCount > 0);

                    // ── Cycle segments: chỉ gửi 1 đoạn, lần sau gửi đoạn tiếp theo ──
                    const validMsgs = s.messages.map((m, i) => ({ msg: m?.trim(), idx: i })).filter(x => x.msg);
                    if (validMsgs.length === 0 || recips.length === 0) continue;
                    const prevIdx = s.lastSegmentIndex ?? -1;
                    const nextSegment = validMsgs.find(x => x.idx > prevIdx) || validMsgs[0];
                    const msg = nextSegment.msg;

                    if (msg) {
                        await fetch("/api/broadcast", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ recipients: recips.map((c: Customer) => ({ psid: c.psid, pageFbId: c.pageFbId, name: c.customerName, conversationId: c.id })), message: msg }),
                        });
                    }
                    const tz = SHOP_TIMEZONES[s.shopName]?.offset ?? 3;
                    const updated = list.map(x => x.id === s.id ? { ...x, lastFiredAt: new Date().toISOString(), nextFireAt: calcNextFireAt(s.hour, tz), lastSegmentIndex: nextSegment.idx } : x);
                    saveSchedules(updated);
                    setSchedules(updated);
                } catch (err) { console.error("Auto-fire error:", err); }
                finally { sendingRef.current.delete(s.id); }
            }
        };
        const interval = setInterval(tick, 30000);
        return () => clearInterval(interval);
    }, []);

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
        setSendResults(null);

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
    const loadCustomers = useCallback(async (shopId: string, page = 1, pageFilter = "") => {
        if (!shopId) return;
        setIsLoadingCustomers(true);
        setSelectedIds(new Set());
        setSendResults(null);

        try {
            let url = `/api/broadcast?shopId=${shopId}&page=${page}`;
            if (pageFilter) url += `&pageFilter=${encodeURIComponent(pageFilter)}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.customers) {
                setCustomers(data.customers);
                setTotalCustomers(data.total || data.customers.length);
                setTotalPages(data.totalPages || 1);
                setCurrentPage(data.page || page);
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
    }, []);

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

        // Purchase filter
        if (filterPurchase === 'no_purchase') {
            // Chưa mua = không có SĐT VÀ orderCount = 0
            result = result.filter(c => !c.customerPhone && c.orderCount === 0);
        } else if (filterPurchase === 'has_purchase') {
            // Đã mua = có SĐT HOẶC có orderCount > 0
            result = result.filter(c => c.customerPhone || c.orderCount > 0);
        }

        // Time range filter
        if (filterTimeRange !== 'all') {
            const now = Date.now();
            const msMap: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
            const cutoff = now - (msMap[filterTimeRange] || 0);
            result = result.filter(c => {
                const t = new Date(c.lastInteraction || c.updatedAt).getTime();
                return t >= cutoff;
            });
        }

        // Gender filter (heuristic by name)
        if (filterGender !== 'all') {
            result = result.filter(c => {
                const name = c.customerName.toLowerCase();
                if (filterGender === 'female') {
                    return /^(chị|chi|ms|mrs|miss|cô|co|em gái|nữ|nu|bà|ba|madam)/i.test(name) || /\b(nữ|nu|chị|chi)\b/i.test(name);
                }
                return /^(anh|mr|ông|ong|bro|bác|bac)/i.test(name) || /\b(anh|nam)\b/i.test(name);
            });
        }

        return result;
    }, [customers, filterPurchase, filterTimeRange, filterGender, filterActive]);

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredCustomers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
        }
    };

    // Combine 4 message boxes
    const messages = [msg1, msg2, msg3, msg4];
    const mediaArrays = [media1, media2, media3, media4];
    const setMediaArrays = [setMedia1, setMedia2, setMedia3, setMedia4];
    const setMessages = [setMsg1, setMsg2, setMsg3, setMsg4];
    const totalMediaCount = media1.length + media2.length + media3.length + media4.length;

    // Handle multi-media upload per box
    const handleMediaUpload = (boxIdx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const removeMedia = (boxIdx: number, mediaIdx: number) => {
        setMediaArrays[boxIdx](prev => prev.filter((_, i) => i !== mediaIdx));
    };

    // Get shop timezone
    const shopName = shops.find(s => s.shop_id === selectedShopId)?.name || "";
    const shopTz = SHOP_TIMEZONES[shopName] || { offset: 3, label: "UTC+3", flag: "🌍" };

    // ─── Schedule actions ────────────────────────────────────────────────────
    const handleSchedule = (hour: number) => {
        if (!selectedShopId || !selectedPageId) {
            setScheduleToast("⚠️ Chọn Shop và Page trước!");
            setTimeout(() => setScheduleToast(null), 3000);
            return;
        }
        const hasContent = messages.some(m => m.trim()) || mediaArrays.some(a => a.length > 0);
        if (!hasContent) {
            setScheduleToast("⚠️ Nhập ít nhất 1 tin nhắn trước!");
            setTimeout(() => setScheduleToast(null), 3000);
            return;
        }
        const pageName = pages.find(p => p.pageId === selectedPageId)?.name || selectedPageId;
        const existing = schedules.find(s => s.shopId === selectedShopId && s.pageId === selectedPageId);
        const tz = shopTz.offset;
        const entry: BroadcastSchedule = {
            id: existing?.id || `${selectedShopId}_${selectedPageId}_${Date.now()}`,
            shopId: selectedShopId,
            shopName: shopName,
            pageId: selectedPageId,
            pageName,
            hour,
            messages: messages.map(m => m.trim()),
            filterPurchase,
            filterTimeRange,
            isActive: true,
            createdAt: existing?.createdAt || new Date().toISOString(),
            lastFiredAt: existing?.lastFiredAt || null,
            nextFireAt: calcNextFireAt(hour, tz),
            note: existing?.note,
        };
        const updated = existing
            ? schedules.map(s => s.id === entry.id ? entry : s)
            : [...schedules, entry];
        saveSchedules(updated);
        setSchedules(updated);
        setScheduleToast(`✅ Đã lưu lịch ${SCHEDULE_LABELS[hour]} cho ${pageName}`);
        setTimeout(() => setScheduleToast(null), 3000);
    };

    const toggleScheduleActive = (id: string) => {
        const updated = schedules.map(s => {
            if (s.id !== id) return s;
            const tz = SHOP_TIMEZONES[s.shopName]?.offset ?? 3;
            return { ...s, isActive: !s.isActive, nextFireAt: !s.isActive ? calcNextFireAt(s.hour, tz) : s.nextFireAt };
        });
        saveSchedules(updated);
        setSchedules(updated);
    };

    const deleteSchedule = (id: string) => {
        const updated = schedules.filter(s => s.id !== id);
        saveSchedules(updated);
        setSchedules(updated);
    };

    const startEditNote = (s: BroadcastSchedule) => {
        setEditingScheduleId(s.id);
        setEditNote(s.note || "");
    };

    const saveNote = (id: string) => {
        const updated = schedules.map(s => s.id === id ? { ...s, note: editNote } : s);
        saveSchedules(updated);
        setSchedules(updated);
        setEditingScheduleId(null);
    };

    const handleCancelSchedule = () => {
        if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setScheduledHour(null);
        setScheduleFireTime(null);
        setCountdown("");
        setIsPaused(false);
        setRemainingMs(0);
    };


    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    // Send a specific box's message
    const handleSendBox = async (boxIdx: number) => {
        const msg = messages[boxIdx]?.trim();
        const boxMedia = mediaArrays[boxIdx];
        if (selectedIds.size === 0 || (!msg && boxMedia.length === 0)) return;
        setIsSending(true);
        setSendResults(null);

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const recipients = customers
            .filter((c) => selectedIds.has(c.id))
            .map((c) => ({ psid: c.psid, pageFbId: c.pageFbId, name: c.customerName, conversationId: c.id }));

        try {
            const payload: Record<string, unknown> = { recipients, message: msg || '' };
            if (boxMedia.length > 0) {
                payload.images = boxMedia;
            }

            const res = await fetch("/api/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal,
            });
            const data = await res.json();
            if (data.error) {
                setSendResults([{ psid: "error", name: "System", success: false, error: data.error }]);
            } else {
                setSendResults(data.results || []);
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                setSendResults([{ psid: 'cancelled', name: 'System', success: false, error: '🚫 Đã huỷ gửi' }]);
            } else {
                console.error("Broadcast error:", err);
                setSendResults([{ psid: "error", name: "System", success: false, error: "Network error" }]);
            }
        } finally {
            setIsSending(false);
            abortControllerRef.current = null;
        }
    };

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

    const successCount = sendResults?.filter((r) => r.success).length || 0;
    const failCount = sendResults ? sendResults.length - successCount : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📩</span> Gửi Tin Nhắn Hàng Loạt
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Lấy khách từ Pancake POS · Gửi tin qua Facebook Messenger
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    HUMAN_AGENT tag · 7 ngày
                </div>
            </div>

            {/* Controls Row */}
            {/* ─── Single control row: Shop + Page + Filters + Button ─── */}
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
                                    onClick={() => { setSelectedPageId(""); setIsPageDropdownOpen(false); setPageSearch(""); setCustomers([]); setSelectedIds(new Set()); setSendResults(null); setFilterActive(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors border-b border-slate-100 ${!selectedPageId ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-600"}`}
                                >
                                    Tất cả pages ({pages.length})
                                </button>
                                {filteredPages.map((p) => (
                                    <button
                                        key={p.pageId}
                                        onClick={() => { setSelectedPageId(p.pageId); setIsPageDropdownOpen(false); setPageSearch(""); setCustomers([]); setSelectedIds(new Set()); setSendResults(null); setFilterActive(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors ${selectedPageId === p.pageId ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-700"}`}
                                    >
                                        <span className="block truncate">{p.name}</span>
                                        <span className="block text-[10px] text-slate-400 font-mono">{p.pageId}</span>
                                    </button>
                                ))}
                                {filteredPages.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">Không tìm thấy page</div>}
                            </div>
                        </>
                    )}
                </div>

                {/* Filter: Purchase */}
                <div className="flex-shrink-0">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">🛒 Trạng thái</label>
                    <select
                        value={filterPurchase}
                        onChange={(e) => { setFilterPurchase(e.target.value as typeof filterPurchase); setFilterActive(false); }}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300/40 shadow-sm"
                    >
                        <option value="all">Tất cả KH</option>
                        <option value="no_purchase">Nhắn tin chưa mua</option>
                        <option value="has_purchase">Đã mua hàng</option>
                    </select>
                </div>

                {/* Filter: Time */}
                <div className="flex-shrink-0">
                    <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">📅 Thời gian</label>
                    <select
                        value={filterTimeRange}
                        onChange={(e) => { setFilterTimeRange(e.target.value as typeof filterTimeRange); setFilterActive(false); }}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300/40 shadow-sm"
                    >
                        <option value="all">Mọi thời gian</option>
                        <option value="24h">24 giờ qua</option>
                        <option value="7d">7 ngày qua</option>
                        <option value="30d">30 ngày qua</option>
                        <option value="90d">90 ngày qua</option>
                    </select>
                </div>

                {/* Lọc + Refresh + Count */}
                <div className="flex items-end gap-2 flex-shrink-0">
                    <button onClick={() => loadCustomers(selectedShopId, currentPage, selectedPageId)} disabled={!selectedShopId || isLoadingCustomers} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm">
                        <RefreshCw className={`h-4 w-4 ${isLoadingCustomers ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={async () => { await loadCustomers(selectedShopId, 1, selectedPageId); setFilterActive(true); }} disabled={!selectedShopId || isLoadingCustomers} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                        🔍 Lọc data
                    </button>
                    {filterActive && (
                        <button onClick={() => { setFilterActive(false); setFilterPurchase('all'); setFilterTimeRange('all'); setFilterGender('all'); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors shadow-sm">
                            ✕
                        </button>
                    )}
                    <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 text-sm whitespace-nowrap">
                        <span className="font-semibold text-violet-700">{selectedIds.size}</span>
                        <span className="text-violet-500">/{filterActive ? filteredCustomers.length : totalCustomers} chọn</span>
                    </div>
                </div>
            </div>

            {/* Customer List */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[40px_1fr_120px_80px_100px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider items-center">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center" title="Chọn tất cả">
                        {selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0
                            ? <CheckSquare className="h-4 w-4 text-violet-600" />
                            : <Square className="h-4 w-4 text-slate-400" />
                        }
                    </button>
                    <span>Khách hàng</span>
                    <span>SĐT</span>
                    <span className="text-center">Tin nhắn</span>
                    <span className="text-right">Ngày</span>
                </div>

                {/* Loading */}
                {isLoadingCustomers && (
                    <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Đang tải danh sách khách...
                    </div>
                )}

                {/* Empty */}
                {!isLoadingCustomers && filteredCustomers.length === 0 && selectedShopId && customers.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-400">
                        <Filter className="h-8 w-8 mb-2 text-slate-300" />
                        Không có khách phù hợp bộ lọc
                    </div>
                )}

                {!isLoadingCustomers && customers.length === 0 && selectedShopId && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-400">
                        <Users className="h-8 w-8 mb-2 text-slate-300" />
                        {selectedPageId ? "Không có khách nào từ page này" : "Chọn page để xem khách hàng"}
                    </div>
                )}

                {/* No shop */}
                {!selectedShopId && !isLoadingShops && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-400">
                        <MessageSquare className="h-8 w-8 mb-2 text-slate-300" />
                        Chọn shop để xem danh sách pages
                    </div>
                )}

                <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
                    {filteredCustomers.map((c) => {
                        const isSelected = selectedIds.has(c.id);
                        const result = sendResults?.find((r) => r.psid === c.psid);
                        const name = c.customerName || "Không rõ tên";
                        const phone = c.customerPhone || "";
                        const msgs = c.messageCount || c.orderCount || 0;
                        const sub = (c.snippet || c.address || "").replace(/[\r\n]+/g, " ").slice(0, 80);

                        return (
                            <div
                                key={c.id}
                                className={`grid grid-cols-[40px_1fr_120px_80px_100px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-slate-50/80 transition-colors ${
                                    isSelected ? "bg-violet-50/50" : ""
                                } ${
                                    result?.success ? "!bg-green-50/50" : result && !result.success ? "!bg-red-50/50" : ""
                                }`}
                                onClick={() => toggleSelect(c.id)}
                            >
                                {/* Checkbox */}
                                <div className="flex items-center justify-center">
                                    {result ? (
                                        result.success
                                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            : <XCircle className="h-4 w-4 text-red-500" />
                                    ) : isSelected
                                        ? <CheckSquare className="h-4 w-4 text-violet-600" />
                                        : <Square className="h-4 w-4 text-slate-300" />
                                    }
                                </div>

                                {/* Name */}
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
                                        {c.conversationLink && (
                                            <a
                                                href={c.conversationLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-violet-400 hover:text-violet-600"
                                                title="Mở Pancake"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                    {sub && (
                                        <p className="text-[10px] text-slate-400 truncate max-w-[300px]">{sub}</p>
                                    )}
                                </div>

                                {/* Phone */}
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                    {phone && <Phone className="h-3 w-3 text-slate-400" />}
                                    <span className="truncate">{phone || "—"}</span>
                                </div>

                                {/* Messages */}
                                <div className="flex items-center justify-center gap-1 text-xs">
                                    <MessageSquare className="h-3 w-3 text-slate-400" />
                                    <span className={msgs > 0 ? "text-blue-600 font-semibold" : "text-slate-400"}>
                                        {msgs}
                                    </span>
                                </div>

                                {/* Date */}
                                <p className="text-[11px] text-slate-400 text-right">{formatTime(c.updatedAt || "")}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Total count */}
                {filteredCustomers.length > 0 && (
                    <div className="flex items-center justify-center px-4 py-2 bg-slate-50 border-t border-slate-100">
                        <span className="text-xs text-slate-400">
                            Hiển thị: {filteredCustomers.length} · Tổng: {totalCustomers} khách · Đã chọn: {selectedIds.size}
                        </span>
                    </div>
                )}
            </div>

            {/* Message Composer - 4 Boxes */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        ✏️ Soạn tin nhắn broadcast
                    </label>
                    <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                        {totalMediaCount} media · {selectedIds.size} người nhận
                    </span>
                </div>

                {/* 4 Message Boxes */}
                <div className="space-y-4">
                    {[
                        { idx: 0, label: 'ĐOẠN 1 – Nhắc lại thành phần', color: 'emerald', hour: '6:00', placeholder: 'VD: 🌿 Sản phẩm chứa Niacinamide, Vitamin C...' },
                        { idx: 1, label: 'ĐOẠN 2 – Nhắc lại feedback KH', color: 'blue', hour: '11:00', placeholder: 'VD: ⭐ Chị Hoa thấy da sáng hẳn sau 2 tuần...' },
                        { idx: 2, label: 'ĐOẠN 3 – Kêu gọi mua hàng', color: 'violet', hour: '17:00', placeholder: 'VD: 🔥 FLASH SALE giảm 50%! Inbox ngay...' },
                        { idx: 3, label: 'ĐOẠN 4 – Nội dung khác', color: 'rose', hour: '21:00', placeholder: 'VD: 🌙 Cảm ơn quý khách đã ủng hộ...' },
                    ].map(({ idx, label, color, hour, placeholder }) => {
                        const boxMedia = mediaArrays[idx];
                        const boxMsg = messages[idx];
                        const setMsg = setMessages[idx];
                        const colorMap: Record<string, Record<string, string>> = {
                            emerald: { border: 'border-emerald-100', bg: 'bg-emerald-50/20', badge: 'bg-emerald-500', text: 'text-emerald-600', mediaBorder: 'border-emerald-200', inputBorder: 'border-emerald-100', ring: 'focus:ring-emerald-300/30', uploadBorder: 'border-emerald-200 hover:border-emerald-400', uploadBg: 'hover:bg-emerald-50', uploadText: 'text-emerald-400' },
                            blue: { border: 'border-blue-100', bg: 'bg-blue-50/20', badge: 'bg-blue-500', text: 'text-blue-600', mediaBorder: 'border-blue-200', inputBorder: 'border-blue-100', ring: 'focus:ring-blue-300/30', uploadBorder: 'border-blue-200 hover:border-blue-400', uploadBg: 'hover:bg-blue-50', uploadText: 'text-blue-400' },
                            violet: { border: 'border-violet-100', bg: 'bg-violet-50/20', badge: 'bg-violet-500', text: 'text-violet-600', mediaBorder: 'border-violet-200', inputBorder: 'border-violet-100', ring: 'focus:ring-violet-300/30', uploadBorder: 'border-violet-200 hover:border-violet-400', uploadBg: 'hover:bg-violet-50', uploadText: 'text-violet-400' },
                            rose: { border: 'border-rose-100', bg: 'bg-rose-50/20', badge: 'bg-rose-500', text: 'text-rose-600', mediaBorder: 'border-rose-200', inputBorder: 'border-rose-100', ring: 'focus:ring-rose-300/30', uploadBorder: 'border-rose-200 hover:border-rose-400', uploadBg: 'hover:bg-rose-50', uploadText: 'text-rose-400' },
                        };
                        const c = colorMap[color];
                        return (
                            <div key={idx} className={`rounded-lg border ${c.border} ${c.bg} p-3 space-y-2`}>
                                <div className="flex items-center justify-between">
                                    <label className={`text-[11px] font-semibold ${c.text} flex items-center gap-1.5`}>
                                        <span className={`w-5 h-5 rounded-full ${c.badge} text-white flex items-center justify-center text-[10px] font-bold`}>{idx + 1}</span>
                                        {label}
                                    </label>
                                    <span className="text-[10px] text-slate-400 bg-white/70 px-1.5 py-0.5 rounded">⏰ {hour}</span>
                                </div>
                                {/* Side-by-side: Media Left, Text Right */}
                                <div className="flex gap-3">
                                    {/* Media Gallery - Left */}
                                    <div className="flex-shrink-0" style={{ minWidth: '20%', maxWidth: '33%' }}>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {boxMedia.map((src, mi) => (
                                                <div key={mi} className="relative group flex-shrink-0">
                                                    {src.startsWith('data:video') ? (
                                                        <video src={src} className={`w-14 h-14 rounded-lg object-cover border ${c.mediaBorder}`} muted />
                                                    ) : (
                                                        <img src={src} alt="" className={`w-14 h-14 rounded-lg object-cover border ${c.mediaBorder}`} />
                                                    )}
                                                    <button onClick={() => removeMedia(idx, mi)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="h-2.5 w-2.5" /></button>
                                                </div>
                                            ))}
                                            <label className={`w-14 h-14 flex-shrink-0 rounded-lg border-2 border-dashed ${c.uploadBorder} bg-white/50 ${c.uploadBg} flex flex-col items-center justify-center cursor-pointer transition-colors gap-0.5`}>
                                                <ImagePlus className={`h-3.5 w-3.5 ${c.uploadText}`} />
                                                <span className={`text-[7px] ${c.uploadText}`}>+Ảnh/Video</span>
                                                <input type="file" accept="image/*,video/*" multiple onChange={handleMediaUpload(idx)} className="hidden" />
                                            </label>
                                        </div>
                                    </div>
                                    {/* Text - Right */}
                                    <textarea
                                        value={boxMsg}
                                        onChange={(e) => setMsg(e.target.value)}
                                        placeholder={placeholder}
                                        rows={5}
                                        className={`flex-1 min-w-0 rounded-lg border ${c.inputBorder} bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 ${c.ring} resize-none`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ⏰ Schedule Timer */}
                <div className="rounded-lg border border-amber-100 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                                <CalendarClock className="h-4 w-4" />
                                Hẹn giờ bắn bot · {shopTz.flag} {shopName} ({shopTz.label}, UTC+{shopTz.offset})
                            </label>
                            <span className="text-[10px] text-amber-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Giờ hiện tại: {getCurrentTimeInTimezone(shopTz.offset)}
                            </span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {/* Bắn ngay + Huỷ bắn */}
                            <div className="relative flex flex-col gap-1">
                                {!isSending ? (
                                    <select
                                        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) handleSendBox(v); e.target.value = ''; }}
                                        disabled={selectedIds.size === 0}
                                        className="w-full rounded-lg px-2 py-2.5 text-center transition-all border-2 border-red-300 bg-gradient-to-b from-red-500 to-orange-500 text-white shadow-md shadow-red-200 hover:shadow-red-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed appearance-none text-sm font-bold"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>⚡ Bắn ngay</option>
                                        <option value="0">Đoạn 1</option>
                                        <option value="1">Đoạn 2</option>
                                        <option value="2">Đoạn 3</option>
                                        <option value="3">Đoạn 4</option>
                                    </select>
                                ) : (
                                    <button
                                        onClick={() => { abortControllerRef.current?.abort(); setIsSending(false); }}
                                        className="w-full rounded-lg px-2 py-2.5 text-center transition-all border-2 border-red-600 bg-red-700 text-white shadow-md animate-pulse text-sm font-bold hover:bg-red-800"
                                    >
                                        🛑 HUỶ BẮN
                                    </button>
                                )}
                            </div>
                            {SCHEDULE_HOURS.map((hour) => {
                                const isActive = scheduledHour === hour;
                                return (
                                    <button
                                        key={hour}
                                        onClick={() => handleSchedule(hour)}
                                        disabled={selectedIds.size === 0 || messages.every(m => !m?.trim())}
                                        className={`relative rounded-lg px-3 py-2.5 text-center transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                                            isActive
                                                ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-200"
                                                : "border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-700"
                                        }`}
                                    >
                                        <div className="text-lg font-bold">{hour}:00</div>
                                        <div className={`text-[10px] ${isActive ? "text-amber-100" : "text-slate-400"}`}>
                                            {SCHEDULE_LABELS[hour]}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                </div>
            </div>

            {/* ─── Toast notification ──────────────────────────────────────────── */}
            <AnimatePresence>
                {scheduleToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-800 shadow-sm"
                    >
                        {scheduleToast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Schedule List ──────────────────────────────────────────────── */}
            {schedules.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-violet-500" />
                            Lịch bắn bot hàng ngày
                            <span className="text-[11px] font-normal text-slate-400">({schedules.length} lịch)</span>
                        </h3>
                        <button
                            onClick={() => { saveSchedules([]); setSchedules([]); }}
                            className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                        >
                            Xoá tất cả
                        </button>
                    </div>

                    {schedules.map(s => {
                        const tz = SHOP_TIMEZONES[s.shopName];
                        const nextMs = s.nextFireAt ? new Date(s.nextFireAt).getTime() - Date.now() : null;
                        const isEditing = editingScheduleId === s.id;
                        return (
                            <div key={s.id} className={`rounded-xl border p-3 space-y-2 transition-colors ${
                                s.isActive ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-slate-50/60"
                            }`}>
                                {/* Row 1: Actions (left) + Info (right) */}
                                <div className="flex items-start gap-3">
                                    {/* Action buttons - đầu hàng */}
                                    <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                                        {/* Pause / Resume */}
                                        <button
                                            onClick={() => toggleScheduleActive(s.id)}
                                            title={s.isActive ? "Tạm dừng" : "Tiếp tục"}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                                s.isActive
                                                    ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                                    : "bg-green-100 text-green-700 hover:bg-green-200"
                                            }`}
                                        >
                                            {s.isActive ? <><Timer className="h-3 w-3" /> Dừng</> : <><Clock className="h-3 w-3" /> Chạy</>}
                                        </button>
                                        {/* Edit note */}
                                        <button
                                            onClick={() => startEditNote(s)}
                                            title="Ghi chú"
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
                                        >
                                            <MessageSquare className="h-3 w-3" /> Ghi chú
                                        </button>
                                        {/* Delete */}
                                        <button
                                            onClick={() => deleteSchedule(s.id)}
                                            title="Xoá"
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                                        >
                                            <X className="h-3 w-3" /> Xoá
                                        </button>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] font-bold text-slate-700">{s.shopName}</span>
                                            <span className="text-slate-300">·</span>
                                            <span className="text-[11px] text-slate-600 truncate max-w-[160px]">{s.pageName}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                s.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
                                            }`}>
                                                {s.isActive ? "● Đang chạy" : "⏸ Tạm dừng"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[11px] text-violet-600 font-semibold">
                                                {SCHEDULE_LABELS[s.hour]} · {s.hour}:00 {tz ? `(${tz.flag} ${tz.label})` : ""}
                                            </span>
                                            {s.nextFireAt && nextMs !== null && nextMs > 0 && (
                                                <span className="text-[10px] text-slate-400">
                                                    ⏳ còn {formatCountdown(nextMs)}
                                                </span>
                                            )}
                                            {s.lastFiredAt && (
                                                <span className="text-[10px] text-slate-400">
                                                    · Gửi lần cuối: {new Date(s.lastFiredAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            )}
                                        </div>
                                        {s.messages.filter(Boolean).length > 0 && (
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                💬 {s.messages.filter(Boolean).join(" · ").slice(0, 80)}{s.messages.join("").length > 80 ? "…" : ""}
                                            </p>
                                        )}
                                    </div>
                                </div>



                                {/* Note row */}
                                {isEditing && (
                                    <div className="flex gap-2">
                                        <input
                                            value={editNote}
                                            onChange={e => setEditNote(e.target.value)}
                                            placeholder="Ghi chú..."
                                            className="flex-1 text-xs rounded-lg border border-blue-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                        />
                                        <button onClick={() => saveNote(s.id)} className="text-xs px-2 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600">Lưu</button>
                                        <button onClick={() => setEditingScheduleId(null)} className="text-xs px-2 py-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300">Huỷ</button>
                                    </div>
                                )}
                                {!isEditing && s.note && (
                                    <p className="text-[10px] text-slate-400 italic">📝 {s.note}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
