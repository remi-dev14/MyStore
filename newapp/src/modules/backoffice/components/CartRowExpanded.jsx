import { ShoppingBag } from 'lucide-react';

export default function CartRowExpanded({ expandLoading, expandedRows }) {
  if (expandLoading) {
    return <p className="text-xs text-slate-400 italic px-8 py-3">Chargement...</p>;
  }
  if (expandedRows.length === 0) {
    return <p className="text-xs text-slate-400 px-8 py-3">Panier vide.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-indigo-100/60">
            <th className="text-left px-8 py-2 text-indigo-600 font-semibold">Produit</th>
            <th className="text-left px-3 py-2 text-indigo-600 font-semibold">Déclinaison</th>
            <th className="text-right px-6 py-2 text-indigo-600 font-semibold w-20">Qté</th>
          </tr>
        </thead>
        <tbody>
          {expandedRows.map((row, i) => (
            <tr key={i} className="border-t border-indigo-100">
              <td className="px-8 py-2 font-medium text-slate-700 flex items-center gap-1.5">
                <ShoppingBag size={12} className="text-indigo-400 shrink-0" />
                {row.productName}
              </td>
              <td className="px-3 py-2 text-slate-500">{row.variant || '—'}</td>
              <td className="px-6 py-2 text-right font-bold text-slate-700">{row.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
