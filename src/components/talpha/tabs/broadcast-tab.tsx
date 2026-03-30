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
    via?: 'pancake' | 'fb_graph_api';
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
    const [visibleCount, setVisibleCount] = useState(100);

    // ─── Schedule states ──────────────────────────────────────────────────────
    const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editNote, setEditNote] = useState("");
    const [scheduleToast, setScheduleToast] = useState<string | null>(null);
    const sendingRef = useRef<Set<string>>(new Set());
    const [showSchedulePreview, setShowSchedulePreview] = useState(false);
    const [scheduledSegments, setScheduledSegments] = useState<Set<number>>(new Set());
    const [isGlobalPaused, setIsGlobalPaused] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem("broadcast_global_paused") !== "false";
    });

    const toggleGlobalPause = () => {
        setIsGlobalPaused(prev => {
            const next = !prev;
            localStorage.setItem("broadcast_global_paused", String(next));
            setScheduleToast(next ? "⛔ Đã TẠM DỮNG tất cả lịch bắn bot" : "✅ Đã BẬT LẠI lịch bắn bot");
            setTimeout(() => setScheduleToast(null), 3000);
            return next;
        });
    };

    // Load schedules from localStorage on mount
    useEffect(() => { setSchedules(loadSchedules()); }, []);

    // ⛔ Auto-fire: TẮT HOÀN TOÀN
    // User chỉ dùng nút "Bắn ngay" thủ công.
    // Auto-fire timer 30s gây gửi lặp do chạy ngầm → đã tắt.
    // Nếu cần bật lại auto-fire sau, uncomment block này.
    /*
    useEffect(() => {
        let tickRunning = false;
        const tick = async () => {
            if (tickRunning) return;
            if (localStorage.getItem("broadcast_global_paused") !== "false") return;
            tickRunning = true;
            try {
                // ... auto-fire logic
            } finally { tickRunning = false; }
        };
        const interval = setInterval(tick, 30000);
        return () => clearInterval(interval);
    }, []);
    */

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

    // CRM warning state
    const [crmWarning, setCrmWarning] = useState<string | null>(null);

    // Load customers (with optional page filter)
    const loadCustomers = useCallback(async (shopId: string, page = 1, pageFilter = "") => {
        if (!shopId) return;
        setIsLoadingCustomers(true);
        setSelectedIds(new Set());
        setSendResults(null);
        setCrmWarning(null);

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
                // Show CRM warning if present
                if (data.crmWarning) {
                    setCrmWarning(data.crmWarning);
                }
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

    // ═══ 24h WINDOW STATS: tính số khách trong/ngoài 24h ═══
    const windowStats = useMemo(() => {
        const now = Date.now();
        const cutoff24h = now - 86400000; // 24h ago
        let within = 0;
        let outside = 0;
        const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
        for (const c of selectedCustomers) {
            const t = new Date(c.lastInteraction || c.updatedAt).getTime();
            if (t >= cutoff24h) within++;
            else outside++;
        }
        return { within, outside, total: selectedCustomers.length };
    }, [customers, selectedIds]);

    const selectOnly24h = () => {
        const now = Date.now();
        const cutoff24h = now - 86400000;
        const ids = new Set(
            customers
                .filter(c => {
                    const t = new Date(c.lastInteraction || c.updatedAt).getTime();
                    return t >= cutoff24h;
                })
                .map(c => c.id)
        );
        setSelectedIds(ids);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === customers.length && customers.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(customers.map((c) => c.id)));
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

    // ─── Hẹn tất cả đoạn theo mapping cố định ───────────────────────────────
    // Đoạn 1 → 6h, Đoạn 2 → 11h, Đoạn 3 → 17h, Đoạn 4 → 21h
    const SEGMENT_HOUR_MAP = [6, 11, 17, 21];

    const handleScheduleAll = () => {
        if (!selectedShopId || !selectedPageId) {
            setScheduleToast("⚠️ Chọn Shop và Page trước!");
            setTimeout(() => setScheduleToast(null), 3000);
            return;
        }
        // Tìm đoạn nào đã có nội dung
        const filledSegments = messages
            .map((m, i) => ({ idx: i, msg: m.trim(), media: mediaArrays[i] }))
            .filter(s => s.msg || s.media.length > 0);

        if (filledSegments.length === 0) {
            setScheduleToast("⚠️ Nhập ít nhất 1 đoạn tin nhắn trước!");
            setTimeout(() => setScheduleToast(null), 3000);
            return;
        }

        const pageName = pages.find(p => p.pageId === selectedPageId)?.name || selectedPageId;
        const tz = shopTz.offset;
        let updatedSchedules = [...schedules];

        filledSegments.forEach(seg => {
            const hour = SEGMENT_HOUR_MAP[seg.idx];
            // ID duy nhất theo shop + page + giờ
            const scheduleId = `${selectedShopId}_${selectedPageId}_h${hour}`;
            const existing = updatedSchedules.find(s => s.id === scheduleId);
            const entry: BroadcastSchedule = {
                id: scheduleId,
                shopId: selectedShopId,
                shopName: shopName,
                pageId: selectedPageId,
                pageName,
                hour,
                messages: [seg.msg], // chỉ gửi đoạn tương ứng
                filterPurchase,
                filterTimeRange,
                isActive: true,
                createdAt: existing?.createdAt || new Date().toISOString(),
                lastFiredAt: existing?.lastFiredAt || null,
                nextFireAt: calcNextFireAt(hour, tz),
                note: `Đoạn ${seg.idx + 1}`,
            };
            if (existing) {
                updatedSchedules = updatedSchedules.map(s => s.id === scheduleId ? entry : s);
            } else {
                updatedSchedules = [...updatedSchedules, entry];
            }
        });

        saveSchedules(updatedSchedules);
        setSchedules(updatedSchedules);
        // Đánh dấu các đoạn đã được accept
        setScheduledSegments(new Set(filledSegments.map(s => s.idx)));
        const hourList = filledSegments.map(s => `${SEGMENT_HOUR_MAP[s.idx]}h`).join(', ');
        setScheduleToast(`✅ Đã hẹn ${filledSegments.length} lịch: ${hourList} cho ${pageName}`);
        setTimeout(() => setScheduleToast(null), 4000);
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
    const sendingLockRef = useRef(false);
    const lastSentTimeRef = useRef(0); // Cooldown tracker
    const [batchProgress, setBatchProgress] = useState<{ sent: number; total: number } | null>(null);
    const [sendingLog, setSendingLog] = useState<{ name: string; status: 'pending' | 'sending' | 'success' | 'error'; error?: string }[]>([]);
    const logScrollRef = useRef<HTMLDivElement>(null);
    const [sendDropdownOpen, setSendDropdownOpen] = useState(false);
    const [forceGraphAPI, setForceGraphAPI] = useState(false);

    const handleSendBox = async (boxIdx: number) => {
        // ═══ NUCLEAR GUARD: window-level global flag ═══
        // Không bị reset khi React re-render, không bị bypass bởi multiple component instances
        if ((window as unknown as Record<string, boolean>).__broadcastSending) {
            console.warn('[broadcast] BLOCKED by window flag');
            return;
        }
        if (sendingLockRef.current) {
            console.warn('[broadcast] BLOCKED by ref lock');
            return;
        }
        const cooldownLeft = 10000 - (Date.now() - lastSentTimeRef.current);
        if (cooldownLeft > 0) {
            console.warn(`[broadcast] BLOCKED: cooldown ${Math.ceil(cooldownLeft/1000)}s`);
            return;
        }
        const msg = messages[boxIdx]?.trim();
        const boxMedia = mediaArrays[boxIdx];
        if (selectedIds.size === 0 || (!msg && boxMedia.length === 0)) return;

        // Set ALL locks
        (window as unknown as Record<string, boolean>).__broadcastSending = true;
        sendingLockRef.current = true;
        setSendDropdownOpen(false);
        setIsSending(true);
        setSendResults(null);
        setSendingLog([]);

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        const allRecipients = customers
            .filter((c) => selectedIds.has(c.id))
            .map((c) => ({ psid: c.psid, pageFbId: c.pageFbId, name: c.customerName, conversationId: c.id }));

        try {
            // Ảnh gửi trực tiếp base64 — server sẽ convert → FormData → Pancake
            const imageData: string[] = boxMedia.length > 0 ? boxMedia : [];

            // ── GỬI TỪNG NGƯỜI 1 — CLIENT LOOP ──
            const allResults: SendResult[] = [];

            // Khởi tạo log cho tất cả recipients
            setSendingLog(allRecipients.map(r => ({ name: r.name, status: 'pending' as const })));

            for (let i = 0; i < allRecipients.length; i++) {
                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

                const recipient = allRecipients[i];
                setBatchProgress({ sent: i, total: allRecipients.length });

                // Mark current as 'sending'
                setSendingLog(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'sending' as const } : item));
                // Auto-scroll
                setTimeout(() => logScrollRef.current?.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: 'smooth' }), 50);

                try {
                    let res: Response;
                    if (imageData.length > 0) {
                        // Gửi FormData để tránh Vercel JSON body limit 4.5MB
                        const fd = new FormData();
                        fd.append('recipients', JSON.stringify([recipient]));
                        fd.append('message', msg || '');
                        // Convert base64 data URLs → Blob → File
                        for (let imgIdx = 0; imgIdx < imageData.length; imgIdx++) {
                            const imgStr = imageData[imgIdx];
                            if (imgStr.startsWith('data:')) {
                                const resp = await fetch(imgStr);
                                const blob = await resp.blob();
                                const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
                                fd.append('images', new File([blob], `img_${imgIdx}.${ext}`, { type: blob.type }));
                            }
                        }
                        if (forceGraphAPI) fd.append('forceGraphAPI', 'true');
                        res = await fetch("/api/broadcast", { method: "POST", body: fd, signal });
                    } else {
                        res = await fetch("/api/broadcast", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ recipients: [recipient], message: msg || '', forceGraphAPI }),
                            signal,
                        });
                    }
                    const data = await res.json();
                    if (data.results && data.results.length > 0) {
                        allResults.push(...data.results);
                        const ok = data.results[0]?.success;
                        setSendingLog(prev => prev.map((item, idx) => idx === i ? { ...item, status: ok ? 'success' as const : 'error' as const, error: data.results[0]?.error } : item));
                    } else if (data.error) {
                        allResults.push({ psid: recipient.psid, name: recipient.name, success: false, error: data.error });
                        setSendingLog(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' as const, error: data.error } : item));
                    }
                } catch (err) {
                    if (err instanceof Error && err.name === 'AbortError') throw err;
                    allResults.push({ psid: recipient.psid, name: recipient.name, success: false, error: "Network error" });
                    setSendingLog(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error' as const, error: 'Network error' } : item));
                }

                if (i < allRecipients.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            setBatchProgress({ sent: allRecipients.length, total: allRecipients.length });
            setSendResults(allResults);

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                setSendResults([{ psid: 'cancelled', name: 'System', success: false, error: '🚫 Đã huỷ gửi' }]);
            } else {
                console.error("Broadcast error:", err);
                setSendResults([{ psid: "error", name: "System", success: false, error: "Network error" }]);
            }
        } finally {
            // Release ALL locks
            (window as unknown as Record<string, boolean>).__broadcastSending = false;
            setIsSending(false);
            sendingLockRef.current = false;
            lastSentTimeRef.current = Date.now(); // Start 10s cooldown
            // GIỮ batchProgress ở sent=total để thanh bar hiển thị 100% xanh lá
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

    // Batch progress UI helper
    const progressPercent = batchProgress ? Math.round((batchProgress.sent / batchProgress.total) * 100) : 0;

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



            {/* CRM Warning Banner */}
            {crmWarning && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">CRM không khả dụng cho page này</p>
                        <p className="text-xs text-amber-700 mt-1">{crmWarning}</p>
                        <p className="text-xs text-amber-600 mt-1">
                            👉 Vào <a href="https://pages.fm" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-800">pages.fm</a> → Đăng nhập lại Facebook → Quay lại đây và bấm 🔍 Lọc data
                        </p>
                    </div>
                    <button onClick={() => setCrmWarning(null)} className="text-amber-500 hover:text-amber-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Customer List */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[80px_1fr_120px_80px_100px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider items-center">
                    <button onClick={toggleSelectAll} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-violet-50 transition-colors" title={`Chọn tất cả ${customers.length} khách`}>
                        {selectedIds.size === customers.length && customers.length > 0
                            ? <CheckSquare className="h-4 w-4 text-violet-600 flex-shrink-0" />
                            : <Square className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        }
                        <span className="text-[10px] font-semibold text-violet-600 whitespace-nowrap">Tất cả</span>
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
                    {filteredCustomers.slice(0, visibleCount).map((c) => {
                        const isSelected = selectedIds.has(c.id);
                        const result = sendResults?.find((r) => r.psid === c.psid);
                        const name = c.customerName || "Không rõ tên";
                        const phone = c.customerPhone || "";
                        const msgs = c.messageCount || c.orderCount || 0;
                        const sub = (c.snippet || c.address || "").replace(/[\r\n]+/g, " ").slice(0, 80);

                        return (
                            <div
                                key={c.id}
                                className={`grid grid-cols-[80px_1fr_120px_80px_100px] gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-slate-50/80 transition-colors ${
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
                    {filteredCustomers.length > visibleCount && (
                        <button
                            onClick={() => setVisibleCount(prev => prev + 200)}
                            className="w-full py-2.5 text-center text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                            Xem thêm ({filteredCustomers.length - visibleCount} còn lại)
                        </button>
                    )}
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

                {/* ═══ BOX LỚN: Hẹn giờ bắn bot + Tiến trình bắn ═══ */}
                <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/40 to-orange-50/20 p-4 space-y-3 shadow-sm">

                    {/* ── ⏰ Hẹn giờ bắn bot ── */}
                    <div className="space-y-2">
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
                            {/* ── Cột trái: 3 nút hành động ── */}
                            <div className="relative flex flex-col gap-1">
                                <div className="relative">
                                    <button
                                        disabled={isSending || selectedIds.size === 0}
                                        onClick={() => setSendDropdownOpen(prev => !prev)}
                                        className="w-full rounded-lg px-2 py-2.5 text-center transition-all border-2 border-red-300 bg-gradient-to-b from-red-500 to-orange-500 text-white shadow-md shadow-red-200 hover:shadow-red-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold"
                                    >
                                        ⚡ Bắn ngay ▾
                                    </button>
                                    {sendDropdownOpen && !isSending && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                                            {[0,1,2,3].map(i => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setSendDropdownOpen(false);
                                                        if (!sendingLockRef.current) handleSendBox(i);
                                                    }}
                                                    disabled={selectedIds.size === 0}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
                                                >
                                                    Đoạn {i+1}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        abortControllerRef.current?.abort();
                                        sendingLockRef.current = false;
                                        setIsSending(false);
                                        setBatchProgress(null);
                                        setSendResults([{ psid: 'cancelled', name: 'System', success: false, error: '🚫 Đã huỷ gửi tin nhắn' }]);
                                        localStorage.setItem("broadcast_global_paused", "true");
                                        setIsGlobalPaused(true);
                                    }}
                                    className="w-full rounded-lg px-2 py-1.5 text-center transition-all border-2 border-red-400 bg-red-50 text-red-700 text-[11px] font-bold hover:bg-red-100"
                                >
                                    ⛔ Huỷ bắn
                                </button>
                            </div>
                            {/* ── Cột phải: Accordion 4 khung giờ ── */}
                            <div className="col-span-4 flex flex-col gap-2">
                                {/* Toggle header – click để mở/đóng */}
                                <button
                                    onClick={() => setShowSchedulePreview(p => !p)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-amber-200 bg-white/90 hover:bg-amber-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2 text-[11px] font-semibold text-amber-700">
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Lịch hẹn giờ
                                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                                            {messages.filter(m => m?.trim()).length + mediaArrays.filter(a => a.length > 0).length} đoạn sẵn sàng
                                        </span>
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform duration-200 ${showSchedulePreview ? 'rotate-180' : ''}`} />
                                </button>
                                {/* Collapsible: 4 ô giờ */}
                                {showSchedulePreview && (
                                    <>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[0,1,2,3].map(i => {
                                            const hour = SEGMENT_HOUR_MAP[i];
                                            const hasFill = !!(messages[i]?.trim() || mediaArrays[i]?.length > 0);
                                            const isScheduled = scheduledSegments.has(i);
                                            return (
                                                <div
                                                    key={i}
                                                    className={`rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                                                        isScheduled && hasFill
                                                            ? "border-green-400 bg-green-50 text-green-800 shadow-sm"
                                                            : hasFill
                                                            ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm"
                                                            : "border-dashed border-slate-200 bg-white/60 text-slate-300"
                                                    }`}
                                                >
                                                    <div className="text-base font-bold">{hour}:00</div>
                                                    <div className="text-[9px] mt-0.5">{SCHEDULE_LABELS[hour]}</div>
                                                    <div className={`text-[9px] font-semibold mt-1 ${
                                                        isScheduled && hasFill ? "text-green-600" : hasFill ? "text-amber-600" : "text-slate-300"
                                                    }`}>
                                                        {isScheduled && hasFill ? `✅ Đã hẹn · Đoạn ${i+1}` : hasFill ? `● Đoạn ${i+1}` : `○ Đoạn ${i+1}`}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={handleScheduleAll}
                                        disabled={selectedIds.size === 0 || messages.every(m => !m?.trim())}
                                        className="w-full rounded-lg px-3 py-2.5 text-center transition-all border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-md shadow-amber-200 hover:shadow-amber-300 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        ⏰ Hẹn lịch ({messages.filter(m => m?.trim()).length} đoạn)
                                    </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 📊 Tiến trình gửi tin ── */}
                    <div className="border-t border-amber-200/60 pt-3 space-y-2">
                        <div className="flex items-center justify-between text-sm font-semibold">
                            <span className="text-blue-700 flex items-center gap-1.5">
                                {batchProgress && batchProgress.sent < batchProgress.total ? (
                                    <><span className="animate-pulse">📡</span> Đang gửi...</>
                                ) : sendingLog.length > 0 && sendingLog.every(l => l.status === 'success' || l.status === 'error') ? (
                                    <>✅ Hoàn tất</>
                                ) : (
                                    <>📊 Tiến trình gửi tin</>
                                )}
                            </span>
                            <div className="flex items-center gap-3 text-xs">
                                {sendingLog.length > 0 && (
                                    <>
                                        <span className="text-green-600">✅ {sendingLog.filter(l => l.status === 'success').length}</span>
                                        <span className="text-red-500">❌ {sendingLog.filter(l => l.status === 'error').length}</span>
                                        <span className="text-amber-500">⏳ {sendingLog.filter(l => l.status === 'pending' || l.status === 'sending').length}</span>
                                    </>
                                )}
                                <span className="text-blue-600 font-medium">
                                    {batchProgress ? `${batchProgress.sent}/${batchProgress.total} · ${progressPercent}%` : sendingLog.length > 0 ? '100%' : 'Chờ gửi'}
                                </span>
                            </div>
                        </div>
                        <div className={`w-full rounded-full h-3 overflow-hidden transition-colors duration-500 ${
                            progressPercent >= 100 && sendingLog.length > 0 ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                            <div
                                className={`h-3 rounded-full transition-all duration-500 ease-out ${
                                    !batchProgress && sendingLog.length === 0 ? 'bg-slate-200' :
                                    progressPercent >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                }`}
                                style={{ width: `${(!batchProgress && sendingLog.length === 0) ? 0 : progressPercent}%` }}
                            />
                        </div>
                        {sendingLog.length > 0 ? (
                            <div ref={logScrollRef} className="max-h-36 overflow-y-auto space-y-0.5 rounded-lg bg-white/70 border border-blue-100 p-2">
                                {sendingLog.map((log, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 px-2 py-0.5 rounded text-[11px] transition-colors ${
                                        log.status === 'sending' ? 'bg-blue-50 text-blue-700 font-medium' :
                                        log.status === 'success' ? 'text-green-700' :
                                        log.status === 'error' ? 'text-red-600' :
                                        'text-slate-400'
                                    }`}>
                                        <span className="flex-shrink-0 w-4 text-center">
                                            {log.status === 'pending' && '⏳'}
                                            {log.status === 'sending' && <span className="animate-spin inline-block">⏳</span>}
                                            {log.status === 'success' && '✅'}
                                            {log.status === 'error' && '❌'}
                                        </span>
                                        <span className="truncate flex-1">{idx + 1}. {log.name}</span>
                                        {sendResults && sendResults[idx]?.via === 'fb_graph_api' && (
                                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 border border-blue-200">FB</span>
                                        )}
                                        {log.error && <span className="text-red-400 text-[10px] truncate max-w-[250px]" title={log.error}>{log.error}</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg bg-white/50 border border-blue-100/50 p-2.5 text-center text-[11px] text-slate-300">
                                Chờ gửi tin nhắn...
                            </div>
                        )}
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

                                {/* ─── Segment Status: 4 đoạn bắn ─── */}
                                {s.isActive && (() => {
                                    const tzOffset = SHOP_TIMEZONES[s.shopName]?.offset ?? 3;
                                    const now = new Date();
                                    const targetNow = new Date(now.getTime() + tzOffset * 3600000 + now.getTimezoneOffset() * 60000);
                                    const currentHour = targetNow.getHours();
                                    const currentMin = targetNow.getMinutes();
                                    const currentDecimal = currentHour + currentMin / 60;
                                    
                                    const segments = [
                                        { idx: 0, hour: 6, label: "Đoạn 1", icon: "🌅", time: "6h" },
                                        { idx: 1, hour: 11, label: "Đoạn 2", icon: "☀️", time: "11h" },
                                        { idx: 2, hour: 17, label: "Đoạn 3", icon: "🌆", time: "17h" },
                                        { idx: 3, hour: 21, label: "Đoạn 4", icon: "🌙", time: "21h" },
                                    ];
                                    
                                    // Determine status: done / active / waiting
                                    const completedCount = segments.filter(seg => currentDecimal >= seg.hour + 0.5).length;
                                    
                                    return (
                                        <div className="space-y-1.5 pt-1">
                                            {/* 4 segments row */}
                                            <div className="flex items-center gap-1">
                                                {segments.map((seg) => {
                                                    const isDone = currentDecimal >= seg.hour + 0.5; // 30 phút sau giờ bắn = đã gửi xong
                                                    const isActive = !isDone && currentDecimal >= seg.hour - 0.5 && currentDecimal < seg.hour + 0.5;
                                                    const isNext = !isDone && !isActive && seg.hour === s.hour;
                                                    
                                                    return (
                                                        <div
                                                            key={seg.idx}
                                                            className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                                                isDone
                                                                    ? "bg-green-100 text-green-700 border border-green-200"
                                                                    : isActive
                                                                    ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
                                                                    : isNext
                                                                    ? "bg-violet-50 text-violet-600 border border-violet-200"
                                                                    : "bg-slate-50 text-slate-400 border border-slate-100"
                                                            }`}
                                                        >
                                                            <span>{seg.icon}</span>
                                                            <span>{seg.time}</span>
                                                            {isDone && <span>✓</span>}
                                                            {isActive && <span>⚡</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Mini progress bar */}
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-green-400 to-emerald-500"
                                                        style={{ width: `${Math.min(100, (completedCount / 4) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                                                    {completedCount}/4 đoạn
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
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
