import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { getLangValue } from '../../../utils/xmlParser.js';
import { Plus } from 'lucide-react';

export default function StockForm({ products, selected, setSelected, delta, setDelta, combinations, selectedCombination, setSelectedCombination, loading, result, onSubmit }) {
  return (
    <Card>
      <CardTitle className="mb-4 flex items-center gap-2">
        <Plus size={16} className="text-indigo-500" /> Ajouter du stock
      </CardTitle>
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Produit</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{getLangValue(p.name, 1)} (id={p.id})</option>
            ))}
          </select>
        </div>

        {combinations.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Déclinaison</label>
            <select
              value={selectedCombination}
              onChange={(e) => setSelectedCombination(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="all">Toutes</option>
              <option value="0">Produit principal</option>
              {combinations.map((c) => (
                <option key={c.id} value={c.id}>{c.reference || `Déclinaison id=${c.id}`}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantité</label>
          <input
            type="number" min="1" value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          <Plus size={15} /> {loading ? 'En cours...' : 'Ajouter'}
        </Button>
      </form>

      {result && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <strong>Stock mis à jour</strong>
          {result.oldQty !== undefined && <span className="ml-2">Avant : {result.oldQty}</span>}
          {result.newQty !== undefined && <span className="ml-2">→ Après : {result.newQty}</span>}
        </div>
      )}
    </Card>
  );
}
