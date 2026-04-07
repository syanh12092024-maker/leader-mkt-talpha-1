import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { shipments, getStatus, MARKETS, MKT_OWNERS } from '../data/mockData';
import StatusBadge from './StatusBadge';

export default function ShipmentTable() {
  const [search, setSearch] = useState('');
  const [marketFilter, setMarketFilter] = useState('Tất cả');
  const [mktFilter, setMktFilter] = useState('Tất cả');
  const [sort, setSort] = useState({ key: 'id', asc: true });

  const filtered = shipments
    .filter(s => marketFilter === 'Tất cả' || s.country.includes(marketFilter.replace('Tất cả', '')))
    .filter(s => mktFilter === 'Tất cả' || s.mktOwner === mktFilter)
    .filter(s =>
      search === '' ||
      s.product.toLowerCase().includes(search.toLowerCase()) ||
      s.trackingCode.toLowerCase().includes(search.toLowerCase()) ||
      s.sku.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierName.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort.asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const handleSort = (key) => setSort(s => ({ key, asc: s.key === key ? !s.asc : true }));
  const SortIcon = ({ k }) => sort.key === k
    ? (sort.asc ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />)
    : <ChevronDown size={12} className="text-slate-600" />;

  const fmt = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-700/50">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm SKU, tracking, sản phẩm..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
        <select value={marketFilter} onChange={e => setMarketFilter(e.target.value)}
          className="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50">
          {MARKETS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={mktFilter} onChange={e => setMktFilter(e.target.value)}
          className="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50">
          {MKT_OWNERS.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} lô hàng</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {[
                ['id', '#'], ['product', 'Sản phẩm'], ['country', 'Thị trường'],
                ['mktOwner', 'MKT'], ['quantity', 'SL'], ['shippingMethod', 'VC'],
                ['trackingCode', 'Tracking'], ['paymentDate', 'TT NCC'], ['factoryShipDate', 'NM gửi'],
                ['eta1', 'ETA về'], ['actual1', 'Thực về'], [null, 'Trạng thái']
              ].map(([key, label]) => (
                <th key={label}
                  onClick={() => key && handleSort(key)}
                  className={`px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${key ? 'cursor-pointer hover:text-slate-300 select-none' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {label} {key && <SortIcon k={key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, idx) => {
              const status = getStatus(s);
              const isDelay = status.code === 'delay';
              return (
                <tr key={s.id}
                  className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/40
                    ${isDelay ? 'bg-amber-500/5' : idx % 2 === 0 ? '' : 'bg-slate-800/20'}`}
                >
                  <td className="px-3 py-3 text-slate-500 font-mono text-xs">{s.id}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-200 whitespace-nowrap">{s.product}</div>
                    {s.sku && <div className="text-xs text-slate-600 font-mono">{s.sku}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-slate-300 whitespace-nowrap">{s.country}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full">{s.mktOwner}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-300 text-right font-mono">
                    {s.quantity.toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.shippingMethod === 'Air' ? 'bg-sky-500/20 text-sky-400' :
                      s.shippingMethod === 'Express' ? 'bg-violet-500/20 text-violet-400' :
                      'bg-teal-500/20 text-teal-400'
                    }`}>{s.shippingMethod}</span>
                  </td>
                  <td className="px-3 py-3">
                    {s.trackingCode
                      ? <span className="text-xs font-mono text-slate-400">{s.trackingCode.slice(0, 14)}{s.trackingCode.length > 14 ? '...' : ''}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{fmt(s.paymentDate)}</td>
                  <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{fmt(s.factoryShipDate)}</td>
                  <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{fmt(s.eta1)}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    {s.actual1
                      ? <span className="text-emerald-400">{fmt(s.actual1)}</span>
                      : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <StatusBadge shipment={s} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-600">Không tìm thấy lô hàng nào</div>
        )}
      </div>
    </div>
  );
}
