export function StatCard({ label, value, icon: Icon, color = 'indigo', trend }) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', value: 'text-indigo-700' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  value: 'text-amber-700' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-700' },
    rose:   { bg: 'bg-rose-50',   icon: 'text-rose-600',   value: 'text-rose-700' },
  };
  const c = colors[color] ?? colors.indigo;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      {Icon && (
        <div className={`${c.bg} rounded-lg p-3 shrink-0`}>
          <Icon size={22} className={c.icon} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.value}`}>{value}</p>
        {trend && <p className="text-xs text-slate-400 mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
