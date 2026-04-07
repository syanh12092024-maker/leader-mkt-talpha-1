"use client";

import { useState, useMemo } from "react";
import {
    Package, TruckIcon, CheckCircle2, XCircle, AlertTriangle,
    RotateCcw, Clock, DollarSign, FileText, ChevronDown, ChevronUp,
    RefreshCw, Clipboard, BarChart2, Filter, Plus, Minus, AlertCircle,
    CheckSquare, Circle, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type OrderStatus =
    | "Mới"
    | "Đang xác nhận"
    | "Đã xác nhận"
    | "Đang đóng gói"
    | "Đã giao cho VC"
    | "Đang giao"
    | "Giao thành công"
    | "Hoàn hàng"
    | "Hủy";

interface Order {
    id: string;
    customer: string;
    phone: string;
    product: string;
    market: string;
    status: OrderStatus;
    cod: number;
    createdAt: string;
    trackingCode?: string;
    note?: string;
    returnReason?: string;
    vcPartner?: string;
}

// ─── Mock data (will be replaced by API) ────────────────────────────────────

const MOCK_ORDERS: Order[] = [
    { id: "ORD-001", customer: "Ahmed Ali", phone: "+966501234567", product: "SmileCare Denture", market: "🇸🇦 KSA", status: "Giao thành công", cod: 120, createdAt: "2026-03-20", trackingCode: "SA123456789", vcPartner: "Aramex" },
    { id: "ORD-002", customer: "Mohammed Khalid", phone: "+971522345678", product: "SmileCare Denture", market: "🇦🇪 UAE", status: "Đang giao", cod: 135, createdAt: "2026-03-20", trackingCode: "AE987654321", vcPartner: "DHL" },
    { id: "ORD-003", customer: "Fatima Hassan", phone: "+96565432100", product: "SmileCare Denture", market: "🇰🇼 KWT", status: "Hoàn hàng", cod: 110, createdAt: "2026-03-19", returnReason: "Khách không nghe máy", vcPartner: "Kuwait Post" },
    { id: "ORD-004", customer: "Aisha Rahman", phone: "+96812345678", product: "SmileCare Pro", market: "🇴🇲 OMN", status: "Đã giao cho VC", cod: 150, createdAt: "2026-03-21", trackingCode: "OM456123789", vcPartner: "Oman Post" },
    { id: "ORD-005", customer: "Yusuf Al-Nasser", phone: "+97412378456", product: "SmileCare Denture", market: "🇶🇦 QAT", status: "Mới", cod: 125, createdAt: "2026-03-21", vcPartner: "" },
    { id: "ORD-006", customer: "Mariam Saleh", phone: "+97312478965", product: "SmileCare Pro", market: "🇧🇭 BHR", status: "Đang xác nhận", cod: 140, createdAt: "2026-03-21" },
    { id: "ORD-007", customer: "Omar Farouq", phone: "+966512345678", product: "SmileCare Denture", market: "🇸🇦 KSA", status: "Hủy", cod: 120, createdAt: "2026-03-18", returnReason: "Sai địa chỉ" },
];

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; icon: React.ElementType; label: string }> = {
    "Mới":              { color: "text-slate-600",  bg: "bg-slate-100",  icon: Circle,        label: "Mới" },
    "Đang xác nhận":   { color: "text-amber-600",  bg: "bg-amber-50",   icon: Clock,         label: "Đang xác nhận" },
    "Đã xác nhận":     { color: "text-blue-600",   bg: "bg-blue-50",    icon: CheckSquare,   label: "Đã xác nhận" },
    "Đang đóng gói":   { color: "text-indigo-600", bg: "bg-indigo-50",  icon: Package,       label: "Đang đóng gói" },
    "Đã giao cho VC":  { color: "text-purple-600", bg: "bg-purple-50",  icon: TruckIcon,     label: "Đã giao VC" },
    "Đang giao":       { color: "text-cyan-600",   bg: "bg-cyan-50",    icon: TruckIcon,     label: "Đang giao" },
    "Giao thành công": { color: "text-emerald-600",bg: "bg-emerald-50", icon: CheckCircle2,  label: "Thành công" },
    "Hoàn hàng":       { color: "text-orange-600", bg: "bg-orange-50",  icon: RotateCcw,     label: "Hoàn hàng" },
    "Hủy":             { color: "text-red-600",    bg: "bg-red-50",     icon: XCircle,       label: "Hủy" },
};

// ─── Quy trình 7 bước ─────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
    { step: 1, title: "Nhận đơn từ Sale", desc: "Nhận đơn đã chốt + xác nhận từ Sale/Call Center. Lọc đơn hợp lệ.", responsible: "NV Vận đơn", time: "Đầu ngày", warning: "Check thông tin đầy đủ", icon: FileText },
    { step: 2, title: "Kiểm tra thông tin", desc: "Kiểm tra: tên, SĐT, địa chỉ chính xác theo từng thị trường, SP, SL, giá.", responsible: "NV Vận đơn", time: "30p", warning: "⚠️ Check địa chỉ chuẩn QT", icon: AlertTriangle },
    { step: 3, title: "Lên đơn trên POS", desc: "Tạo đơn hàng trên POS Cake. Gắn thông tin SP, giá, mã VC.", responsible: "NV Vận đơn", time: "2h/batch", warning: "Đối chiếu với order gốc", icon: Clipboard },
    { step: 4, title: "In bill / phiếu giao", desc: "In bill giao hàng, phiếu xuất kho.", responsible: "NV Vận đơn", time: "5p/đơn", warning: null, icon: FileText },
    { step: 5, title: "Đóng gói + kiểm hàng", desc: "Đóng gói SP. Kiểm tra: mặt hàng đúng, số lượng đủ, tình trạng tốt.", responsible: "Kho/NV VĐ", time: "10p/đơn", warning: "QC trước đóng gói", icon: Package },
    { step: 6, title: "Bàn giao cho VC", desc: "Giao đơn cho đối tác vận chuyển. Cung cấp mã tracking.", responsible: "NV Vận đơn", time: "Theo lịch VC", warning: "Lưu bằng chứng bàn giao", icon: TruckIcon },
    { step: 7, title: "Cập nhật trạng thái", desc: "Cập nhật trạng thái đơn hàng trên hệ thống + báo cáo.", responsible: "NV Vận đơn", time: "Liên tục", warning: "Đồng bộ POS + Sheet", icon: RefreshCw },
];

// ─── Return reasons ─────────────────────────────────────────────────────────

const RETURN_REASONS = [
    { reason: "Khách không nghe máy/không liên lạc được", severity: "high", percent: "40%", action: "Gọi lại 3 lần khác giờ, nhờ Sale re-contact" },
    { reason: "Sai địa chỉ / sai SĐT", severity: "high", percent: "25%", action: "Kiểm tra kỹ khi xác nhận đơn – AI auto-validate address" },
    { reason: "Khách từ chối nhận hàng", severity: "medium", percent: "20%", action: "Call Center cố gắng re-delivery, Sale tư vấn lại" },
    { reason: "Hàng lỗi / sai mẫu", severity: "medium", percent: "10%", action: "Kiểm tra kỹ QC trước khi đóng gói" },
    { reason: "Giao chậm → khách không cần nữa", severity: "low", percent: "5%", action: "Theo dõi SLA giao hàng từng thị trường" },
];

// ─── AI Optimization suggestions (từ phân tích ảnh) ─────────────────────────

const AI_SUGGESTIONS = [
    {
        id: 1, priority: "🔴 Cao", title: "Auto-validate địa chỉ quốc tế",
        problem: "25% hoàn do sai địa chỉ – kiểm tra thủ công mất thời gian",
        solution: "Tích hợp Google Address Validation API để kiểm tra địa chỉ ngay khi nhập đơn",
        impact: "Giảm 20-25% tỉ lệ hoàn hàng",
        effort: "2 tuần dev",
    },
    {
        id: 2, priority: "🔴 Cao", title: "Dashboard COD Treo Real-time",
        problem: "COD treo >14 ngày gây rủi ro mất tiền. Hiện theo dõi thủ công.",
        solution: "Dashboard alert tự động khi COD treo quá 10 ngày. Phân loại theo VC partner.",
        impact: "Phát hiện sớm 100% COD treo",
        effort: "1 tuần dev",
    },
    {
        id: 3, priority: "🟡 Trung bình", title: "Checklist NV Vận đơn tự động",
        problem: "NV phải nhớ 7 bước checklist hàng ngày – dễ bỏ sót",
        solution: "Digital checklist tích hợp ngay trong tab này, tự reset mỗi ngày",
        impact: "0% bỏ sót bước trong quy trình",
        effort: "3 ngày dev",
    },
    {
        id: 4, priority: "🟡 Trung bình", title: "Auto-batch lên đơn POS",
        problem: "Lên đơn 2h/batch thủ công – tốn nhân lực",
        solution: "Kết nối API POS Cake để tự động tạo đơn từ data Sale nhập",
        impact: "Tiết kiệm 2-3 giờ/ngày NV vận đơn",
        effort: "3 tuần dev",
    },
    {
        id: 5, priority: "🟢 Thấp", title: "Report hoàn hàng theo thị trường",
        problem: "Tỉ lệ hoàn 15-50% khác nhau theo market – chưa có báo cáo chi tiết",
        solution: "Báo cáo tự động phân tích nguyên nhân hoàn hàng theo thị trường & SP",
        impact: "Điều chỉnh chiến lược per-market",
        effort: "1 tuần dev",
    },
];

// ─── Daily Checklist ────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
    { time: "Đầu ngày (10p)", tasks: ["Review danh sách đơn mới từ Sale", "Check thông tin: tên, SĐT, địa chỉ", "Flagging đơn có vấn đề"] },
    { time: "Sáng (2h)", tasks: ["Lên đơn hàng loạt trên POS", "In bill giao hàng + phiếu kho", "Bàn giao đơn cho kho đóng gói"] },
    { time: "Trong ngày", tasks: ["Cập nhật tracking từ VC", "Xử lý đơn hoàn về kho", "Contact khách khi giao thất bại"] },
    { time: "Cuối ngày", tasks: ["Đối soát COD từ VC", "Cập nhật báo cáo trạng thái", "Review checklist đầu mục CV"] },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function VanDonTab() {
    const [activeSection, setActiveSection] = useState<"overview" | "orders" | "workflow" | "return" | "optimize">("overview");
    const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
    const [marketFilter, setMarketFilter] = useState("all");
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());

    // stats
    const totalOrders = MOCK_ORDERS.length;
    const successOrders = MOCK_ORDERS.filter(o => o.status === "Giao thành công").length;
    const returnOrders = MOCK_ORDERS.filter(o => o.status === "Hoàn hàng").length;
    const cancelOrders = MOCK_ORDERS.filter(o => o.status === "Hủy").length;
    const inDelivery = MOCK_ORDERS.filter(o => o.status === "Đang giao").length;
    const totalCOD = MOCK_ORDERS.filter(o => o.status === "Giao thành công").reduce((sum, o) => sum + o.cod, 0);
    const returnRate = ((returnOrders + cancelOrders) / totalOrders * 100).toFixed(1);

    const filteredOrders = useMemo(() => {
        return MOCK_ORDERS.filter(o => {
            const byStatus = statusFilter === "all" || o.status === statusFilter;
            const byMarket = marketFilter === "all" || o.market.includes(marketFilter);
            return byStatus && byMarket;
        });
    }, [statusFilter, marketFilter]);

    const toggleTask = (key: string) => {
        setCheckedTasks(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const NAV_SECTIONS = [
        { id: "overview",  label: "📊 Tổng quan",       desc: "KPI & Checklist hàng ngày" },
        { id: "orders",    label: "📦 Quản lý đơn",     desc: "Danh sách & lọc trạng thái" },
        { id: "workflow",  label: "🔄 Quy trình 7 bước", desc: "SOP vận đơn chuẩn" },
        { id: "return",    label: "↩️ Phân tích hoàn",  desc: "Nguyên nhân & hành động" },
        { id: "optimize",  label: "🤖 Tối ưu AI",       desc: "Đề xuất cải tiến quy trình" },
    ] as const;

    return (
        <div className="flex h-full gap-4">
            {/* Left subnav */}
            <div className="w-52 flex-shrink-0 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-3">Vận đơn</p>
                {NAV_SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id as typeof activeSection)}
                        className={cn(
                            "w-full text-left rounded-xl px-3 py-2.5 transition-all",
                            activeSection === s.id
                                ? "bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-300/30 shadow-sm"
                                : "hover:bg-slate-100/70"
                        )}
                    >
                        <div className={cn("text-[13px] font-semibold", activeSection === s.id ? "text-orange-700" : "text-slate-700")}>{s.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                    </button>
                ))}
            </div>

            {/* Main panel */}
            <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">

                {/* ─── OVERVIEW ──────────────────────────────────────────── */}
                {activeSection === "overview" && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-xl">📦</span> Tổng quan Vận đơn
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Theo dõi KPI vận hành · Quy trình 7 bước chuẩn hóa</p>
                        </div>

                        {/* KPI cards */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {[
                                { label: "Tổng đơn", value: totalOrders, color: "text-slate-700", bg: "bg-white", icon: Package },
                                { label: "Đang giao", value: inDelivery, color: "text-cyan-700", bg: "bg-cyan-50", icon: TruckIcon },
                                { label: "Thành công", value: successOrders, color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle2 },
                                { label: "Hoàn hàng", value: returnOrders, color: "text-orange-700", bg: "bg-orange-50", icon: RotateCcw },
                                { label: "Tỉ lệ hoàn", value: `${returnRate}%`, color: Number(returnRate) > 30 ? "text-red-700" : "text-amber-700", bg: Number(returnRate) > 30 ? "bg-red-50" : "bg-amber-50", icon: AlertTriangle },
                                { label: "COD Thu", value: `$${totalCOD}`, color: "text-blue-700", bg: "bg-blue-50", icon: DollarSign },
                            ].map((k, i) => (
                                <div key={i} className={`${k.bg} rounded-xl border border-slate-200 p-3 shadow-sm`}>
                                    <k.icon className={`h-4 w-4 ${k.color} mb-1.5 opacity-70`} />
                                    <div className={`text-xl font-black ${k.color}`}>{k.value}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{k.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Alert nếu tỉ lệ hoàn cao */}
                        {Number(returnRate) > 30 && (
                            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-red-700">⚠️ Tỉ lệ hoàn hàng cao: {returnRate}%</p>
                                    <p className="text-xs text-red-500 mt-0.5">Mục tiêu: &lt;20%. Xem tab "Phân tích hoàn" để tìm nguyên nhân và hành động cụ thể.</p>
                                </div>
                            </div>
                        )}

                        {/* Daily checklist */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <Clipboard className="h-4 w-4 text-orange-500" />
                                    Checklist hàng ngày – NV Vận đơn
                                </h3>
                                <button
                                    onClick={() => setCheckedTasks(new Set())}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                                >
                                    <RefreshCw className="h-3 w-3" /> Reset
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {CHECKLIST_ITEMS.map((block, bi) => (
                                    <div key={bi} className="space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 border-b border-orange-100 pb-1">{block.time}</p>
                                        {block.tasks.map((task, ti) => {
                                            const key = `${bi}-${ti}`;
                                            const checked = checkedTasks.has(key);
                                            return (
                                                <button
                                                    key={ti}
                                                    onClick={() => toggleTask(key)}
                                                    className={cn(
                                                        "flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 transition-all text-xs",
                                                        checked ? "bg-emerald-50 text-emerald-700 line-through opacity-60" : "hover:bg-slate-50 text-slate-600"
                                                    )}
                                                >
                                                    {checked
                                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                                        : <Circle className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                                                    }
                                                    {task}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                            <div className="text-[11px] text-slate-400 text-center pt-1">
                                ✅ {checkedTasks.size} / {CHECKLIST_ITEMS.reduce((s, b) => s + b.tasks.length, 0)} nhiệm vụ hoàn thành
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── ORDERS ─────────────────────────────────────────────── */}
                {activeSection === "orders" && (
                    <div className="space-y-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span>📦</span> Quản lý đơn hàng
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Theo dõi trạng thái · Lọc theo thị trường</p>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-slate-400" />
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value as OrderStatus | "all")}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300/40"
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <select
                                value={marketFilter}
                                onChange={e => setMarketFilter(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300/40"
                            >
                                <option value="all">Tất cả thị trường</option>
                                {["KSA", "UAE", "KWT", "OMN", "QAT", "BHR"].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <div className="ml-auto text-xs text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
                                {filteredOrders.length} đơn
                            </div>
                        </div>

                        {/* Order list */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                <span>Đơn hàng / Khách</span>
                                <span>Thị trường</span>
                                <span className="text-right">COD</span>
                                <span>VC Partner</span>
                                <span className="text-right">Trạng thái</span>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                                {filteredOrders.map(order => {
                                    const cfg = STATUS_CONFIG[order.status];
                                    const StatusIcon = cfg.icon;
                                    return (
                                        <div key={order.id} className="grid grid-cols-[1fr_100px_80px_120px_100px] gap-2 px-4 py-3 items-center hover:bg-slate-50/80 transition-colors">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-mono text-slate-400">{order.id}</span>
                                                    {order.trackingCode && (
                                                        <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 rounded-full font-mono">{order.trackingCode}</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700 truncate">{order.customer}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <p className="text-[10px] text-slate-400">{order.phone}</p>
                                                    {order.note && <span className="text-[9px] text-amber-600">· {order.note}</span>}
                                                    {order.returnReason && <span className="text-[9px] text-red-500">· {order.returnReason}</span>}
                                                </div>
                                                <p className="text-[10px] text-slate-300">{order.product}</p>
                                            </div>
                                            <span className="text-xs text-slate-600">{order.market}</span>
                                            <span className="text-xs font-bold text-emerald-700 text-right">${order.cod}</span>
                                            <span className="text-xs text-slate-500 truncate">{order.vcPartner || "—"}</span>
                                            <div className="flex justify-end">
                                                <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", cfg.color, cfg.bg)}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── WORKFLOW ───────────────────────────────────────────── */}
                {activeSection === "workflow" && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span>🔄</span> Quy trình vận đơn chuẩn – 7 bước
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">SOP chuẩn hóa từ nhận đơn → giao thành công</p>
                        </div>

                        {/* Status flow diagram */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Luồng trạng thái đơn hàng</p>
                            <div className="flex items-center gap-1 flex-wrap">
                                {(["Mới", "Đang xác nhận", "Đã xác nhận", "Đang đóng gói", "Đã giao cho VC", "Đang giao", "Giao thành công"] as OrderStatus[]).map((s, i, arr) => {
                                    const cfg = STATUS_CONFIG[s];
                                    return (
                                        <div key={s} className="flex items-center gap-1">
                                            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", cfg.color, cfg.bg)}>{cfg.label}</span>
                                            {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-slate-300" />}
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-1 ml-2">
                                    <span className="text-[10px] text-slate-400">|</span>
                                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", STATUS_CONFIG["Hoàn hàng"].color, STATUS_CONFIG["Hoàn hàng"].bg)}>Hoàn hàng</span>
                                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", STATUS_CONFIG["Hủy"].color, STATUS_CONFIG["Hủy"].bg)}>Hủy</span>
                                </div>
                            </div>
                        </div>

                        {/* Step by step */}
                        <div className="space-y-2">
                            {WORKFLOW_STEPS.map(step => {
                                const isOpen = expandedStep === step.step;
                                const StepIcon = step.icon;
                                return (
                                    <div key={step.step} className={cn(
                                        "rounded-xl border transition-all shadow-sm overflow-hidden",
                                        isOpen ? "border-orange-200 bg-orange-50/30" : "border-slate-200 bg-white"
                                    )}>
                                        <button
                                            onClick={() => setExpandedStep(isOpen ? null : step.step)}
                                            className="w-full flex items-center gap-3 px-4 py-3"
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0",
                                                isOpen ? "bg-orange-500 text-white shadow-md shadow-orange-200" : "bg-slate-100 text-slate-600"
                                            )}>
                                                {step.step}
                                            </div>
                                            <StepIcon className={cn("h-4 w-4 flex-shrink-0", isOpen ? "text-orange-600" : "text-slate-400")} />
                                            <div className="flex-1 text-left">
                                                <p className={cn("text-sm font-semibold", isOpen ? "text-orange-800" : "text-slate-700")}>{step.title}</p>
                                                <p className="text-[10px] text-slate-400">{step.responsible} · {step.time}</p>
                                            </div>
                                            {step.warning && (
                                                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 hidden sm:block">{step.warning}</span>
                                            )}
                                            {isOpen ? <ChevronUp className="h-4 w-4 text-orange-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                        </button>
                                        {isOpen && (
                                            <div className="px-4 pb-3 border-t border-orange-100">
                                                <p className="text-sm text-slate-600 mt-2">{step.desc}</p>
                                                {step.warning && (
                                                    <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        {step.warning}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── RETURN ANALYSIS ────────────────────────────────────── */}
                {activeSection === "return" && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span>↩️</span> Phân tích Hoàn hàng
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Tỉ lệ hoàn hiện tại: 15-50% theo thị trường · Mục tiêu: &lt;20%</p>
                        </div>

                        {/* Market breakdown */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {[
                                { market: "🇸🇦 Saudi Arabia", rate: "18.97%", owner: "VĐ_Linh", target: "20%", color: "emerald" },
                                { market: "🇦🇪 UAE", rate: "15-30%", owner: "Phương Anh", target: "20%", color: "amber" },
                                { market: "🇬🇧 EU/UK", rate: "15-50%", owner: "Lan Anh", target: "20%", color: "red" },
                                { market: "🇰🇼 Kuwait", rate: "25-40%", owner: "Phương Anh", target: "20%", color: "red" },
                                { market: "🇦🇺 Úc", rate: "15-25%", owner: "Phương Anh", target: "20%", color: "amber" },
                                { market: "🇶🇦 Qatar / Oman", rate: "20-35%", owner: "VĐ_Linh", target: "20%", color: "amber" },
                            ].map((m, i) => (
                                <div key={i} className={cn(
                                    "rounded-xl border p-3 bg-white shadow-sm",
                                    m.color === "emerald" ? "border-emerald-200" : m.color === "amber" ? "border-amber-200" : "border-red-200"
                                )}>
                                    <p className="text-xs font-semibold text-slate-700">{m.market}</p>
                                    <p className={cn("text-lg font-black mt-1", m.color === "emerald" ? "text-emerald-600" : m.color === "amber" ? "text-amber-600" : "text-red-600")}>{m.rate}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Target: {m.target} · {m.owner}</p>
                                </div>
                            ))}
                        </div>

                        {/* Return reasons */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BarChart2 className="h-4 w-4 text-orange-500" />
                                Nguyên nhân hoàn hàng & Hành động
                            </h3>
                            <div className="space-y-2">
                                {RETURN_REASONS.map((r, i) => (
                                    <div key={i} className={cn(
                                        "rounded-xl border p-3 space-y-1",
                                        r.severity === "high" ? "border-red-100 bg-red-50/30" :
                                        r.severity === "medium" ? "border-amber-100 bg-amber-50/30" :
                                        "border-slate-100 bg-slate-50/30"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-[10px] font-bold rounded-full px-2 py-0.5",
                                                r.severity === "high" ? "bg-red-100 text-red-700" :
                                                r.severity === "medium" ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-600"
                                            )}>{r.percent}</span>
                                            <p className="text-xs font-semibold text-slate-700">{r.reason}</p>
                                        </div>
                                        <div className="flex items-start gap-1.5">
                                            <ArrowRight className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-[11px] text-slate-500">{r.action}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── AI OPTIMIZE ────────────────────────────────────────── */}
                {activeSection === "optimize" && (
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span>🤖</span> Tối ưu AI – Quy trình Vận đơn
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Phân tích từ 5 sheet quy trình · {AI_SUGGESTIONS.length} đề xuất cải thiện
                            </p>
                        </div>

                        {/* Context from images analysis */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                            <p className="text-xs font-bold text-blue-700 flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Phân tích từ tài liệu quy trình
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-700">
                                <div>📋 <strong>9 sheets</strong> quy trình được document</div>
                                <div>🔄 <strong>7 bước</strong> xử lý vận đơn thủ công</div>
                                <div>💰 Cycle COD: <strong>4–17 ngày</strong></div>
                                <div>↩️ Tỉ lệ hoàn: <strong>15–50%</strong> (quá cao)</div>
                                <div>🛠 Công cụ: <strong>Google Sheet + POS + Pancake</strong></div>
                                <div>⏰ Lên đơn: <strong>2h/batch thủ công</strong></div>
                            </div>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-3">
                            {AI_SUGGESTIONS.map(s => (
                                <div key={s.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="flex items-start gap-3 px-4 py-3">
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-black text-slate-600 flex-shrink-0 mt-0.5">
                                            {s.id}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-semibold">{s.priority}</span>
                                                <p className="text-sm font-bold text-slate-800">{s.title}</p>
                                            </div>
                                            <p className="text-xs text-red-600 mt-1">❌ Vấn đề: {s.problem}</p>
                                            <p className="text-xs text-emerald-700 mt-1">✅ Giải pháp: {s.solution}</p>
                                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                                                <span className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                                                    📈 {s.impact}
                                                </span>
                                                <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                                                    ⏱ {s.effort}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Quick wins */}
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                            <p className="text-sm font-bold text-emerald-700">🚀 Quick Wins – Làm ngay tuần này (không cần dev)</p>
                            <div className="space-y-2">
                                {[
                                    "Tạo Google Form cho NV Vận đơn kiểm tra địa chỉ trước khi lên đơn",
                                    "Lập bảng Google Sheet theo dõi COD treo theo VC partner hàng ngày",
                                    "Thiết lập Zalo/Telegram alert khi có đơn hoàn về kho",
                                    "Tạo SOP checklist in ra giấy cho ca đầu ngày của NV vận đơn",
                                    "Thêm cột 'Lý do hoàn' bắt buộc trong POS Cake khi cập nhật trạng thái hoàn",
                                ].map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        {tip}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
