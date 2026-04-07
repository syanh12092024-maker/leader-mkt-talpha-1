import { useState } from 'react';
import { Package, BarChart2, ArrowLeftRight, Bell, ChevronRight, Menu, X, RefreshCw } from 'lucide-react';
import KPICards from './components/KPICards';
import Charts from './components/Charts';
import ShipmentTable from './components/ShipmentTable';
import AlertPanel from './components/AlertPanel';
import TransferTable from './components/TransferTable';
import { shipments, getStatus } from './data/mockData';

const NAV = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart2 },
  { id: 'shipments', label: 'Lô hàng', icon: Package },
  { id: 'transfers', label: 'Chuyển kho', icon: ArrowLeftRight },
  { id: 'alerts', label: 'Cảnh báo', icon: Bell },
];

const delayCount = shipments.filter(s => getStatus(s).code === 'delay').length;

export default function App() {
  const [tab, setTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const now = new Date().toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-900/95 border-r border-slate-800/60 backdrop-blur-xl flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <Package size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">Flow Hàng</div>
            <div className="text-[10px] text-slate-500">LEADER MKT TALPHA</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === id
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
            >
              <Icon size={16} />
              {label}
              {id === 'alerts' && delayCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {delayCount}
                </span>
              )}
              {tab === id && <ChevronRight size={12} className="ml-auto" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800/60">
          <div className="text-[10px] text-slate-600">Cập nhật lần cuối</div>
          <div className="text-[10px] text-slate-500">{now}</div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-4 lg:px-6 py-3.5 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-white">
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-base font-bold text-white">
              {NAV.find(n => n.id === tab)?.label}
            </h1>
            <p className="text-xs text-slate-500">
              {tab === 'overview' && 'Tổng quan toàn bộ flow hàng'}
              {tab === 'shipments' && `${shipments.length} lô hàng từ Trung Quốc`}
              {tab === 'transfers' && 'Di chuyển hàng giữa các kho'}
              {tab === 'alerts' && 'Cảnh báo cần xử lý'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="https://docs.google.com/spreadsheets/d/1MFV6X_Lppace2F7t8PX0MZwt6otWRmV-gbOdZBIC7Ak/"
              target="_blank" rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors border border-slate-700/50 rounded-lg px-3 py-1.5">
              <RefreshCw size={12} />
              Google Sheets
            </a>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-auto">
          {tab === 'overview' && (
            <>
              <KPICards />
              <Charts />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Lô hàng gần đây</h2>
                  <ShipmentTable />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Cảnh báo</h2>
                  <AlertPanel />
                </div>
              </div>
            </>
          )}
          {tab === 'shipments' && (
            <div className="space-y-4">
              <KPICards />
              <ShipmentTable />
            </div>
          )}
          {tab === 'transfers' && <TransferTable />}
          {tab === 'alerts' && <AlertPanel />}
        </div>
      </main>
    </div>
  );
}
