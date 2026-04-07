import { AlertTriangle, Clock } from 'lucide-react';
import { shipments, getStatus } from '../data/mockData';

const delays = shipments.filter(s => getStatus(s).code === 'delay');
const pending_payment = shipments.filter(s => s.orderDate && !s.paymentDate);
const waiting_eta = shipments.filter(s => {
  if (!s.eta1 || s.actual1) return false;
  const eta = new Date(s.eta1);
  const diff = (eta - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 5;
});

export default function AlertPanel() {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-300">Cảnh báo & Thông báo</h3>
        {(delays.length + pending_payment.length + waiting_eta.length) > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
            {delays.length + pending_payment.length + waiting_eta.length}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {delays.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <div className="text-xs font-semibold text-amber-400 mb-2">⚠️ Delay – Quá ETA chưa về kho</div>
            {delays.map(s => (
              <div key={s.id} className="text-xs text-slate-400 py-1 border-b border-amber-500/10 last:border-0 flex justify-between">
                <span>#{s.id} {s.product} → {s.country}</span>
                <span className="text-amber-400">ETA: {new Date(s.eta1).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}

        {pending_payment.length > 0 && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <div className="text-xs font-semibold text-red-400 mb-2">💸 Chưa thanh toán NCC</div>
            {pending_payment.map(s => (
              <div key={s.id} className="text-xs text-slate-400 py-1 border-b border-red-500/10 last:border-0 flex justify-between">
                <span>#{s.id} {s.product} – {s.mktOwner}</span>
                <span className="text-red-400">Đặt: {new Date(s.orderDate).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}

        {waiting_eta.length > 0 && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
            <div className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
              <Clock size={12} /> Sắp về kho trong 5 ngày tới
            </div>
            {waiting_eta.map(s => (
              <div key={s.id} className="text-xs text-slate-400 py-1 flex justify-between">
                <span>#{s.id} {s.product} → {s.country}</span>
                <span className="text-blue-400">ETA: {new Date(s.eta1).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
          </div>
        )}

        {(delays.length + pending_payment.length + waiting_eta.length) === 0 && (
          <div className="text-center py-6 text-slate-600 text-sm">
            ✅ Không có cảnh báo nào
          </div>
        )}
      </div>
    </div>
  );
}
