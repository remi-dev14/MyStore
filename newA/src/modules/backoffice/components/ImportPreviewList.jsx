import { FileText, AlertCircle, X } from 'lucide-react';
import { Badge } from '../../../shared/ui/Badge.jsx';

const TYPE_LABELS = {
  fichier1: 'Produits',
  fichier2: 'Stock/Déclinaisons',
  fichier3: 'Clients/Commandes',
  zip: 'Images ZIP',
  unknown: 'Type non reconnu',
};

export default function ImportPreviewList({ preview, hasErrors }) {
  if (!preview.length) return null;

  return (
    <div className="mt-5 space-y-3">
      {preview.map((p, i) => {
        const hasErr = p.errors.length > 0;
        return (
          <div key={i} className={`rounded-xl border overflow-hidden ${hasErr ? 'border-red-200' : 'border-emerald-200'}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 ${hasErr ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <span className="text-sm font-semibold flex items-center gap-2">
                <FileText size={14} className={hasErr ? 'text-red-400' : 'text-emerald-500'} />
                {p.file}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={hasErr ? 'danger' : 'success'}>{TYPE_LABELS[p.type] ?? p.type}</Badge>
                {p.total > 0 && <span className="text-xs text-slate-400">{p.total} ligne(s)</span>}
              </div>
            </div>

            {p.errors.length > 0 && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                <p className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Erreurs de validation
                </p>
                <ul className="space-y-0.5">
                  {p.errors.map((e, j) => (
                    <li key={j} className="text-xs text-red-500">
                      <em>{e.column}</em>{e.row > 0 && ` (ligne ${e.row})`} — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {p.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      {p.columns.map((col, j) => (
                        <th key={j} className="px-3 py-2 text-left text-slate-500 font-semibold border-b border-slate-100 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map((row, j) => (
                      <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        {p.columns.map((col, k) => (
                          <td key={k} className="px-3 py-1.5 border-b border-slate-50 max-w-[160px] truncate text-slate-600">{row[col] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {p.total > 5 && <p className="text-xs text-slate-400 px-3 py-1.5">… {p.total - 5} ligne(s) supplémentaire(s)</p>}
              </div>
            )}
          </div>
        );
      })}

      {hasErrors && (
        <div className="flex items-center gap-2 text-red-600 text-sm font-semibold">
          <X size={16} /> Import bloqué — corriger les erreurs ci-dessus.
        </div>
      )}
    </div>
  );
}
