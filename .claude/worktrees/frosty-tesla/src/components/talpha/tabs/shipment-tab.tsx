"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package, Plus, Search, Filter, Truck, CheckCircle2,
    AlertTriangle, Clock, X, ChevronDown, ChevronRight,
    Edit3, Trash2, Eye, PackageCheck, Globe, Users,
    CalendarDays, ImageIcon, ExternalLink, History
} from "lucide-react";

// ═══ TYPES ═══
interface Shipment {
    id: string;
    stt: number;
    country: string;
    shippingPartner: string;
    mktPerson: string;
    mktDate: string;
    trackingCode: string;
    sku: string;
    productName: string;
    imageUrl: string;
    supplierName: string;
    supplierLink: string;
    quantity: number;
    attributes: string;
    dateOrdered: string;
    dateShippedChina: string;
    dateDest1Expected: string;
    dateDest1Actual: string;
    pricePerUnit: number;
    shippingCostPerUnit: number;
    totalCost: number;
    receivedQty: number;
    pendingQty: number;
    status: string;
    reason: string;
    note: string;
    statusHistory: StatusEntry[];
    batches: Batch[];
    createdAt: string;
    updatedAt: string;
}

interface StatusEntry {
    status: string;
    note: string;
    createdAt: string;
}

interface Batch {
    id: string;
    batchNumber: number;
    quantity: number;
    dateSent: string;
    dateReceived: string;
    note: string;
}

interface Distribution {
    id: string;
    shipmentId: string;
    productName: string;
    imageUrl: string;
    country: string;
    partner: string;
    quantity: number;
    sentQty: number;
    receivedQty: number;
    trackingCodes: string[];
    dateSent: string;
    status: string;
    note: string;
    createdAt: string;
}

// ═══ CONSTANTS ═══
const COUNTRIES = ['UAE', 'KSA', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Úc', 'USA', 'Romania', 'Đài Loan'];
const PARTNERS = ['Floria', 'Naza', 'Flip', 'Saquib', 'Chris', 'A Việt'];
const MKT_PEOPLE = ['Hồ Sỹ Anh', 'Hồ Sỹ Lộc', 'Chu Thị Thuý', 'Phạm Hà Thục Mai', 'Nguyễn Ngọc Thế', 'Nguyễn Thị Nhung', 'Đặng Sỹ Mạnh'];
const ALL_STATUSES = [
    'MKT yêu cầu nhập', 'Mua hàng đang kiểm tra', 'Chờ Chị Thuý duyệt', 'Đã duyệt', 'Từ chối',
    'Đã đặt hàng', 'Nhà máy gửi hàng', 'Đã đóng gói', 'Đã xuất kho TQ', 'Đang vận chuyển',
    'Đã đến kho đích 1', 'Đã giao thành công', 'Đã TT tiền hàng',
    'Chuyển tiếp từ UAE', 'Đã nhận 1 phần', 'Có vấn đề', 'Bỏ không nhập',
];
const GCC_COUNTRIES = ['KSA', 'Kuwait', 'Qatar', 'Bahrain', 'Oman'];
const DIST_STATUSES = ['MKT yêu cầu', 'Đang chuyển kho', 'Đã gửi', 'Đã nhận', 'Có vấn đề'];

const STATUS_COLORS: Record<string, string> = {
    'MKT yêu cầu nhập': 'bg-blue-100 text-blue-700',
    'Mua hàng đang kiểm tra': 'bg-yellow-100 text-yellow-700',
    'Chờ Chị Thuý duyệt': 'bg-amber-100 text-amber-800',
    'Đã duyệt': 'bg-green-100 text-green-700',
    'Từ chối': 'bg-red-100 text-red-700',
    'Đã đặt hàng': 'bg-indigo-100 text-indigo-700',
    'Đang vận chuyển': 'bg-purple-100 text-purple-700',
    'Đã đến kho đích 1': 'bg-teal-100 text-teal-700',
    'Đã giao thành công': 'bg-emerald-100 text-emerald-700',
    'Đã TT tiền hàng': 'bg-emerald-200 text-emerald-800',
    'Có vấn đề': 'bg-red-100 text-red-700',
    'Đã nhận 1 phần': 'bg-orange-100 text-orange-700',
    'Bỏ không nhập': 'bg-gray-200 text-gray-600',
};

// ═══ STORAGE ═══
const SHIP_KEY = "shipment_data_v1";
const DIST_KEY = "distribution_data_v1";

function loadShipments(): Shipment[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(SHIP_KEY) || "[]"); } catch { return []; }
}
function saveShipments(d: Shipment[]) { try { localStorage.setItem(SHIP_KEY, JSON.stringify(d)); } catch { /* */ } }
function loadDists(): Distribution[] {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(DIST_KEY) || "[]"); } catch { return []; }
}
function saveDists(d: Distribution[]) { try { localStorage.setItem(DIST_KEY, JSON.stringify(d)); } catch { /* */ } }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ═══ MAIN COMPONENT ═══
export default function ShipmentTab() {
    const [subTab, setSubTab] = useState<'overview' | 'shipments' | 'distributions'>('shipments');
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [distributions, setDistributions] = useState<Distribution[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [detailId, setDetailId] = useState<string | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPhase, setFilterPhase] = useState('');
    const [showDistForm, setShowDistForm] = useState(false);

    // Form state
    const [form, setForm] = useState<Partial<Shipment>>({});
    const [distForm, setDistForm] = useState<Partial<Distribution>>({});

    useEffect(() => { setShipments(loadShipments()); setDistributions(loadDists()); }, []);

    // ═══ STATS ═══
    const stats = useMemo(() => {
        const total = shipments.length;
        const pending = shipments.filter(s => s.status === 'Chờ Chị Thuý duyệt').length;
        const inTransit = shipments.filter(s => ['Đã xuất kho TQ', 'Đang vận chuyển', 'Đã đến kho đích 1'].includes(s.status)).length;
        const delivered = shipments.filter(s => ['Đã giao thành công', 'Đã TT tiền hàng'].includes(s.status)).length;
        const issues = shipments.filter(s => s.status === 'Có vấn đề').length;
        const late = shipments.filter(s => {
            if (!s.dateDest1Expected) return false;
            return new Date(s.dateDest1Expected) < new Date() && !['Đã giao thành công', 'Đã TT tiền hàng', 'Bỏ không nhập'].includes(s.status);
        }).length;
        return { total, pending, inTransit, delivered, issues, late };
    }, [shipments]);

    // ═══ FILTERED LIST ═══
    const filtered = useMemo(() => {
        let list = [...shipments];
        if (searchQ) {
            const q = searchQ.toLowerCase();
            list = list.filter(s => s.productName?.toLowerCase().includes(q) || s.trackingCode?.toLowerCase().includes(q) || String(s.stt).includes(q));
        }
        if (filterCountry) list = list.filter(s => s.country === filterCountry);
        if (filterStatus) list = list.filter(s => s.status === filterStatus);
        if (filterPhase === 'approval') list = list.filter(s => ['MKT yêu cầu nhập', 'Mua hàng đang kiểm tra', 'Chờ Chị Thuý duyệt', 'Đã duyệt', 'Từ chối'].includes(s.status));
        if (filterPhase === 'shipping') list = list.filter(s => ['Đã đặt hàng', 'Nhà máy gửi hàng', 'Đã đóng gói', 'Đã xuất kho TQ', 'Đang vận chuyển', 'Đã đến kho đích 1'].includes(s.status));
        if (filterPhase === 'done') list = list.filter(s => ['Đã giao thành công', 'Đã TT tiền hàng'].includes(s.status));
        if (filterPhase === 'late') list = list.filter(s => s.dateDest1Expected && new Date(s.dateDest1Expected) < new Date() && !['Đã giao thành công', 'Đã TT tiền hàng', 'Bỏ không nhập'].includes(s.status));
        return list.sort((a, b) => b.stt - a.stt);
    }, [shipments, searchQ, filterCountry, filterStatus, filterPhase]);

    // ═══ CRUD ═══
    const handleSave = () => {
        const now = new Date().toISOString();
        if (editingId) {
            const updated = shipments.map(s => s.id === editingId ? { ...s, ...form, updatedAt: now } : s);
            saveShipments(updated); setShipments(updated);
        } else {
            const newShip: Shipment = {
                id: genId(), stt: shipments.length + 1, country: '', shippingPartner: '', mktPerson: '', mktDate: '',
                trackingCode: '', sku: '', productName: '', imageUrl: '', supplierName: '', supplierLink: '',
                quantity: 0, attributes: '', dateOrdered: '', dateShippedChina: '', dateDest1Expected: '', dateDest1Actual: '',
                pricePerUnit: 0, shippingCostPerUnit: 0, totalCost: 0, receivedQty: 0, pendingQty: 0,
                status: 'MKT yêu cầu nhập', reason: '', note: '',
                statusHistory: [{ status: 'MKT yêu cầu nhập', note: 'Tạo mới', createdAt: now }],
                batches: [], createdAt: now, updatedAt: now, ...form,
            } as Shipment;
            const updated = [...shipments, newShip];
            saveShipments(updated); setShipments(updated);
        }
        setShowForm(false); setEditingId(null); setForm({});
    };

    const handleDelete = (id: string) => {
        if (!confirm('Xoá đơn này?')) return;
        const updated = shipments.filter(s => s.id !== id);
        saveShipments(updated); setShipments(updated);
    };

    const handleStatusChange = (id: string, newStatus: string) => {
        const now = new Date().toISOString();
        const updated = shipments.map(s => {
            if (s.id !== id) return s;
            return { ...s, status: newStatus, updatedAt: now, statusHistory: [...s.statusHistory, { status: newStatus, note: '', createdAt: now }] };
        });
        saveShipments(updated); setShipments(updated);
    };

    const handleAddBatch = (shipId: string, qty: number, note: string) => {
        const now = new Date().toISOString();
        const updated = shipments.map(s => {
            if (s.id !== shipId) return s;
            const newBatch: Batch = { id: genId(), batchNumber: s.batches.length + 1, quantity: qty, dateSent: '', dateReceived: now.slice(0, 10), note };
            const totalRecv = s.batches.reduce((sum, b) => sum + b.quantity, 0) + qty;
            const newStatus = totalRecv >= s.quantity && s.quantity > 0 ? 'Đã giao thành công' : totalRecv > 0 ? 'Đã nhận 1 phần' : s.status;
            return { ...s, batches: [...s.batches, newBatch], receivedQty: totalRecv, pendingQty: s.quantity - totalRecv, status: newStatus, updatedAt: now,
                statusHistory: [...s.statusHistory, { status: newStatus, note: `Nhận lần ${s.batches.length + 1}: ${qty} sp`, createdAt: now }] };
        });
        saveShipments(updated); setShipments(updated);
    };

    // ═══ DISTRIBUTION CRUD ═══
    const handleSaveDist = () => {
        const now = new Date().toISOString();
        const newDist: Distribution = {
            id: genId(), shipmentId: '', productName: '', imageUrl: '', country: '', partner: '',
            quantity: 0, sentQty: 0, receivedQty: 0, trackingCodes: [], dateSent: '',
            status: 'MKT yêu cầu', note: '', createdAt: now, ...distForm,
        } as Distribution;
        const updated = [...distributions, newDist];
        saveDists(updated); setDistributions(updated); setShowDistForm(false); setDistForm({});
    };

    const handleDeleteDist = (id: string) => {
        const updated = distributions.filter(d => d.id !== id);
        saveDists(updated); setDistributions(updated);
    };

    const handleDistStatusChange = (id: string, newStatus: string) => {
        const updated = distributions.map(d => d.id === id ? { ...d, status: newStatus } : d);
        saveDists(updated); setDistributions(updated);
    };

    // ═══ DETAIL VIEW ═══
    const detailShipment = shipments.find(s => s.id === detailId);

    // ═══ RENDER ═══
    return (
        <div className="space-y-4">
            {/* Sub-tab nav */}
            <div className="flex items-center gap-2">
                {[
                    { id: 'overview' as const, label: '📊 Tổng quan', icon: PackageCheck },
                    { id: 'shipments' as const, label: '📦 Đơn nhập hàng', icon: Package },
                    { id: 'distributions' as const, label: '🇦🇪 Phân phối GCC', icon: Globe },
                ].map(t => (
                    <button key={t.id} onClick={() => setSubTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${subTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {subTab === 'overview' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-3">
                        {[
                            { label: 'Tổng đơn', value: stats.total, color: 'text-slate-800', bg: 'bg-white' },
                            { label: 'Chờ duyệt', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50 border-l-4 border-yellow-400' },
                            { label: 'Đang VC', value: stats.inTransit, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: 'Đã giao', value: stats.delivered, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Muộn', value: stats.late, color: 'text-red-600', bg: 'bg-red-50 border-l-4 border-red-400' },
                            { label: 'Vấn đề', value: stats.issues, color: 'text-red-600', bg: 'bg-red-50' },
                        ].map(s => (
                            <div key={s.label} className={`${s.bg} rounded-xl shadow-sm p-4 border border-slate-100`}>
                                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    {stats.pending > 0 && (
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 text-sm font-bold text-yellow-800 cursor-pointer hover:bg-yellow-100"
                            onClick={() => { setSubTab('shipments'); setFilterStatus('Chờ Chị Thuý duyệt'); }}>
                            ⚠️ {stats.pending} đơn chờ Chị Thuý duyệt!
                        </div>
                    )}
                    {stats.late > 0 && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm font-bold text-red-700 cursor-pointer hover:bg-red-100"
                            onClick={() => { setSubTab('shipments'); setFilterPhase('late'); }}>
                            🚨 {stats.late} đơn hàng bị MUỘN!
                        </div>
                    )}
                    {/* Recent activity */}
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Hoạt động gần đây</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {shipments.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10).map(s => (
                                <div key={s.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span>
                                    <span className="font-medium text-slate-700">#{s.stt} {s.productName}</span>
                                    <span className="text-slate-400 ml-auto text-xs">{new Date(s.updatedAt).toLocaleDateString('vi')}</span>
                                </div>
                            ))}
                            {shipments.length === 0 && <p className="text-slate-400 text-sm">Chưa có đơn nào</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ SHIPMENTS TABLE ═══ */}
            {subTab === 'shipments' && !detailId && (
                <div className="space-y-3">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => { setForm({}); setEditingId(null); setShowForm(true); }}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200">
                            <Plus className="h-4 w-4" /> Tạo đơn mới
                        </button>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Tìm STT, tên hàng, tracking..."
                                className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" />
                        </div>
                        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
                            <option value="">Quốc gia</option>
                            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
                            <option value="">Trạng thái</option>
                            {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    {/* Phase tabs */}
                    <div className="flex gap-2 text-xs">
                        {[
                            { id: '', label: 'Tất cả' },
                            { id: 'approval', label: 'Đang duyệt' },
                            { id: 'shipping', label: 'Đang VC' },
                            { id: 'done', label: 'Hoàn thành' },
                            { id: 'late', label: 'Muộn / Cảnh báo' },
                        ].map(p => (
                            <button key={p.id} onClick={() => setFilterPhase(p.id)}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition ${filterPhase === p.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left">
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">STT</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Quốc gia</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600 min-w-[200px]">Sản phẩm</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">SL</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">MKT</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Trạng thái</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Nhận</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => (
                                    <tr key={s.id} className="border-t border-slate-50 hover:bg-blue-50/30 transition">
                                        <td className="px-3 py-2.5 font-bold text-indigo-600">{s.stt}</td>
                                        <td className="px-3 py-2.5">{s.country}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                {s.imageUrl && <img src={s.imageUrl} className="w-8 h-8 rounded object-cover" alt="" />}
                                                <div>
                                                    <div className="font-medium text-slate-800">{s.productName || '—'}</div>
                                                    {s.trackingCode && <div className="text-[10px] text-slate-400">{s.trackingCode}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">{s.quantity}</td>
                                        <td className="px-3 py-2.5 text-xs">{s.mktPerson}</td>
                                        <td className="px-3 py-2.5">
                                            <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value)}
                                                className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>
                                                {ALL_STATUSES.map(st => <option key={st}>{st}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs">
                                            {s.receivedQty > 0 ? <span className="text-green-600 font-semibold">{s.receivedQty}/{s.quantity}</span> : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setDetailId(s.id)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500" title="Chi tiết"><Eye className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => { setForm(s); setEditingId(s.id); setShowForm(true); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500" title="Sửa"><Edit3 className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        Chưa có đơn nào. Bấm "Tạo đơn mới" để bắt đầu.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ DETAIL VIEW ═══ */}
            {subTab === 'shipments' && detailId && detailShipment && (
                <div className="space-y-4">
                    <button onClick={() => setDetailId(null)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                        ← Quay lại danh sách
                    </button>
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">#{detailShipment.stt} — {detailShipment.productName || 'Chưa đặt tên'}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[detailShipment.status] || 'bg-gray-100'}`}>{detailShipment.status}</span>
                                    <span className="text-xs text-slate-400">{detailShipment.country} · {detailShipment.shippingPartner}</span>
                                </div>
                            </div>
                            {detailShipment.imageUrl && <img src={detailShipment.imageUrl} className="w-20 h-20 rounded-xl object-cover" alt="" />}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div><span className="text-slate-400">MKT:</span> <span className="font-medium">{detailShipment.mktPerson}</span></div>
                            <div><span className="text-slate-400">SL:</span> <span className="font-medium">{detailShipment.quantity}</span></div>
                            <div><span className="text-slate-400">Đã nhận:</span> <span className="font-medium text-green-600">{detailShipment.receivedQty}/{detailShipment.quantity}</span></div>
                            <div><span className="text-slate-400">Tracking:</span> <span className="font-medium font-mono text-xs">{detailShipment.trackingCode || '—'}</span></div>
                            <div><span className="text-slate-400">NCC:</span> <span className="font-medium">{detailShipment.supplierName || '—'}</span></div>
                            <div><span className="text-slate-400">Ngày đặt:</span> <span className="font-medium">{detailShipment.dateOrdered || '—'}</span></div>
                        </div>
                    </div>
                    {/* Batch receiving */}
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Lần nhận hàng ({detailShipment.batches.length})</h3>
                        {detailShipment.batches.map(b => (
                            <div key={b.id} className="flex items-center gap-3 py-2 border-b border-slate-50 text-sm">
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Lần {b.batchNumber}</span>
                                <span className="font-medium">{b.quantity} sp</span>
                                <span className="text-slate-400">{b.dateReceived}</span>
                                {b.note && <span className="text-slate-400 text-xs">{b.note}</span>}
                            </div>
                        ))}
                        <div className="flex items-center gap-2 mt-3">
                            <input type="number" id="batch-qty" placeholder="SL nhận" className="border rounded-lg px-3 py-1.5 w-24 text-sm" />
                            <input type="text" id="batch-note" placeholder="Ghi chú" className="border rounded-lg px-3 py-1.5 flex-1 text-sm" />
                            <button onClick={() => {
                                const qty = parseInt((document.getElementById('batch-qty') as HTMLInputElement).value) || 0;
                                const note = (document.getElementById('batch-note') as HTMLInputElement).value;
                                if (qty > 0) { handleAddBatch(detailShipment.id, qty, note); }
                            }} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700">+ Nhận hàng</button>
                        </div>
                    </div>
                    {/* Status history */}
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Lịch sử trạng thái</h3>
                        <div className="space-y-2">
                            {detailShipment.statusHistory.map((h, i) => (
                                <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[h.status] || 'bg-gray-100'}`}>{h.status}</span>
                                    <span className="text-slate-400 text-xs">{new Date(h.createdAt).toLocaleString('vi')}</span>
                                    {h.note && <span className="text-slate-500 text-xs">{h.note}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ DISTRIBUTIONS ═══ */}
            {subTab === 'distributions' && (
                <div className="space-y-3">
                    <button onClick={() => setShowDistForm(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200">
                        <Plus className="h-4 w-4" /> Tạo đơn phân phối
                    </button>
                    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left">
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Sản phẩm</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Quốc gia</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Đối tác</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">SL</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Tracking</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600">Trạng thái</th>
                                    <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distributions.map(d => (
                                    <tr key={d.id} className="border-t border-slate-50 hover:bg-purple-50/30">
                                        <td className="px-3 py-2.5 font-medium">{d.productName || '—'}</td>
                                        <td className="px-3 py-2.5">{d.country}</td>
                                        <td className="px-3 py-2.5">{d.partner}</td>
                                        <td className="px-3 py-2.5">{d.quantity}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{d.trackingCodes?.join(', ') || '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <select value={d.status} onChange={e => handleDistStatusChange(d.id, e.target.value)}
                                                className="text-xs font-semibold px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border-0 cursor-pointer">
                                                {DIST_STATUSES.map(st => <option key={st}>{st}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <button onClick={() => handleDeleteDist(d.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </td>
                                    </tr>
                                ))}
                                {distributions.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                                        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        Chưa có đơn phân phối. Bấm "Tạo đơn phân phối" để bắt đầu.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ SHIPMENT FORM MODAL ═══ */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">{editingId ? 'Sửa đơn' : 'Tạo đơn mới'}</h2>
                                <button onClick={() => { setShowForm(false); setForm({}); }} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    { key: 'productName', label: 'Tên sản phẩm', type: 'text', span: 2 },
                                    { key: 'country', label: 'Quốc gia', type: 'select', options: COUNTRIES },
                                    { key: 'shippingPartner', label: 'Đối tác VC', type: 'select', options: PARTNERS },
                                    { key: 'mktPerson', label: 'MKT báo nhập', type: 'select', options: MKT_PEOPLE },
                                    { key: 'quantity', label: 'Số lượng', type: 'number' },
                                    { key: 'imageUrl', label: 'Link ảnh SP', type: 'text', span: 2 },
                                    { key: 'trackingCode', label: 'Mã Tracking', type: 'text' },
                                    { key: 'sku', label: 'SKU / Mã DH', type: 'text' },
                                    { key: 'supplierName', label: 'Tên NCC', type: 'text' },
                                    { key: 'supplierLink', label: 'Link đặt hàng', type: 'text' },
                                    { key: 'dateOrdered', label: 'Ngày đặt', type: 'date' },
                                    { key: 'dateDest1Expected', label: 'Ngày dự kiến đến', type: 'date' },
                                    { key: 'pricePerUnit', label: 'Giá/sp (VND)', type: 'number' },
                                    { key: 'shippingCostPerUnit', label: 'Phí VC/sp', type: 'number' },
                                    { key: 'attributes', label: 'Thuộc tính (size, màu...)', type: 'text', span: 2 },
                                    { key: 'reason', label: 'Lý do nhập', type: 'text', span: 2 },
                                ].map(f => (
                                    <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                                        <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                                        {f.type === 'select' ? (
                                            <select value={(form as Record<string, string>)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2">
                                                <option value="">Chọn...</option>
                                                {f.options?.map(o => <option key={o}>{o}</option>)}
                                            </select>
                                        ) : (
                                            <input type={f.type} value={(form as Record<string, string | number>)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                                                className="w-full border rounded-lg px-3 py-2" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <button onClick={() => { setShowForm(false); setForm({}); }} className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-50">Huỷ</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
                                    {editingId ? 'Cập nhật' : 'Tạo đơn'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ DISTRIBUTION FORM MODAL ═══ */}
            <AnimatePresence>
                {showDistForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">Tạo đơn phân phối GCC</h2>
                                <button onClick={() => { setShowDistForm(false); setDistForm({}); }} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5" /></button>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div><label className="block text-xs text-slate-500 mb-1">Sản phẩm</label>
                                    <select value={distForm.shipmentId || ''} onChange={e => {
                                        const ship = shipments.find(s => s.id === e.target.value);
                                        setDistForm({ ...distForm, shipmentId: e.target.value, productName: ship?.productName || '', imageUrl: ship?.imageUrl || '' });
                                    }} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Chọn từ đơn nhập hàng...</option>
                                        {shipments.map(s => <option key={s.id} value={s.id}>#{s.stt} {s.productName}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-xs text-slate-500 mb-1">Quốc gia</label>
                                    <select value={distForm.country || ''} onChange={e => setDistForm({ ...distForm, country: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Chọn...</option>
                                        {GCC_COUNTRIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-xs text-slate-500 mb-1">Đối tác</label>
                                    <select value={distForm.partner || ''} onChange={e => setDistForm({ ...distForm, partner: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                                        <option value="">Chọn...</option>
                                        {PARTNERS.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-xs text-slate-500 mb-1">Số lượng</label>
                                    <input type="number" value={distForm.quantity || ''} onChange={e => setDistForm({ ...distForm, quantity: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <button onClick={() => { setShowDistForm(false); setDistForm({}); }} className="px-4 py-2 border rounded-xl text-sm hover:bg-slate-50">Huỷ</button>
                                <button onClick={handleSaveDist} className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700">Tạo đơn</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
