import { getStatus } from '../data/mockData';

const statusMeta = {
  arrived: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  transit: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  delay: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  waiting_factory: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  ordered: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
  proposed: { bg: 'bg-slate-600/20', text: 'text-slate-500', border: 'border-slate-600/30' },
};

export default function StatusBadge({ shipment }) {
  const status = getStatus(shipment);
  const meta = statusMeta[status.code] || statusMeta.proposed;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.text} ${meta.border}`}>
      {status.label}
    </span>
  );
}
