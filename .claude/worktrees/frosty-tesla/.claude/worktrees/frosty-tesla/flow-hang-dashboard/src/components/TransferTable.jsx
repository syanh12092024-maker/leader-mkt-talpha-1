import { transfers } from '../data/mockData';

export default function TransferTable() {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">🔁 Chuyển kho nội bộ</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {['#', 'Từ kho', 'Đến kho', 'SKU', 'Số lượng', 'MKT', 'Hãng VC', 'Ngày gửi', 'Ngày về'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs text-slate-500 font-semibold uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                <td className="px-3 py-2.5 text-slate-600 font-mono text-xs">{t.id}</td>
                <td className="px-3 py-2.5">
                  <span className="text-slate-300">{t.from}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-slate-300 flex items-center gap-1">→ {t.to}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{t.sku}</td>
                <td className="px-3 py-2.5 text-right text-slate-300 font-mono">{t.quantity.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full">{t.mkt}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{t.carrier}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(t.shipDate).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-3 py-2.5 text-xs text-emerald-400 whitespace-nowrap">
                  {new Date(t.arrivalDate).toLocaleDateString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
