import { Package, TrendingUp, AlertTriangle, Truck, Globe, CheckCircle } from 'lucide-react';
import { shipments, getStatus, financials } from '../data/mockData';

const countByStatus = (code) => shipments.filter(s => getStatus(s).code === code).length;
const totalQty = shipments.reduce((a, b) => a + b.quantity, 0);
const totalFinancial = financials.reduce((a, b) => a + b.amount, 0);
const inTransitValue = shipments
  .filter(s => ['transit', 'waiting_factory'].includes(getStatus(s).code))
  .reduce((a, b) => a + b.quantity, 0);

const cards = [
  {
    label: 'Tổng lô hàng', value: shipments.length, sub: `${totalQty.toLocaleString()} units tổng cộng`,
    icon: Package, gradient: 'from-blue-600/30 to-blue-800/10', border: 'border-blue-500/20', icon_color: 'text-blue-400'
  },
  {
    label: 'Đã về kho', value: countByStatus('arrived'), sub: `${Math.round(countByStatus('arrived') / shipments.length * 100)}% hoàn thành`,
    icon: CheckCircle, gradient: 'from-emerald-600/30 to-emerald-800/10', border: 'border-emerald-500/20', icon_color: 'text-emerald-400'
  },
  {
    label: 'Đang vận chuyển', value: countByStatus('transit'), sub: `${inTransitValue.toLocaleString()} units trên đường`,
    icon: Truck, gradient: 'from-violet-600/30 to-violet-800/10', border: 'border-violet-500/20', icon_color: 'text-violet-400'
  },
  {
    label: 'Cảnh báo delay', value: countByStatus('delay'), sub: 'Quá ETA chưa về kho',
    icon: AlertTriangle, gradient: 'from-amber-600/30 to-amber-800/10', border: 'border-amber-500/20', icon_color: 'text-amber-400'
  },
  {
    label: 'Tổng vốn hàng', value: `${(totalFinancial / 1e6).toFixed(0)}M`, sub: 'VND đã chi mua hàng',
    icon: TrendingUp, gradient: 'from-pink-600/30 to-pink-800/10', border: 'border-pink-500/20', icon_color: 'text-pink-400'
  },
  {
    label: 'Thị trường', value: '6', sub: 'UAE · Saudi · Úc · USA · Qatar · Oman',
    icon: Globe, gradient: 'from-cyan-600/30 to-cyan-800/10', border: 'border-cyan-500/20', icon_color: 'text-cyan-400'
  },
];

export default function KPICards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label}
            className={`relative rounded-2xl border ${c.border} bg-gradient-to-br ${c.gradient} p-4 backdrop-blur-sm hover:scale-[1.02] transition-transform`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-medium leading-tight">{c.label}</span>
              <Icon size={16} className={c.icon_color} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{c.value}</div>
            <div className="text-xs text-slate-400">{c.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
