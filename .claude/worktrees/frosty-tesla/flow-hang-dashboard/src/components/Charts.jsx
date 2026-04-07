import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { shipments, getStatus } from '../data/mockData';

const byMarket = () => {
  const map = {};
  shipments.forEach(s => {
    const m = s.country.split('–')[0].trim();
    map[m] = (map[m] || 0) + s.quantity;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
};

const byStatus = () => {
  const labels = { arrived: '✅ Đã về', transit: '🚢 Transit', delay: '⚠️ Delay', waiting_factory: '⏳ Chờ NM', ordered: '📋 Đặt hàng', proposed: '📝 Đề xuất' };
  const map = {};
  shipments.forEach(s => {
    const code = getStatus(s).code;
    map[code] = (map[code] || 0) + 1;
  });
  return Object.entries(map).map(([code, value]) => ({ name: labels[code] || code, value, code }));
};

const COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#f43f5e'];

export default function Charts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart - by market */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">📊 Số lượng nhập theo thị trường</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byMarket()} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
              {byMarket().map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - by status */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">🔵 Phân bổ trạng thái lô hàng</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byStatus()} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
              paddingAngle={3} dataKey="value" nameKey="name"
            >
              {byStatus().map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
