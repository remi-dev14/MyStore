import { useState } from 'react';
import { api } from '../../../config/api.js';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { AlertCircle, RotateCcw, CheckCircle, Trash2 } from 'lucide-react';

const SCOPE = [
  'Commandes et paniers',
  'Clients et adresses',
  'Produits, déclinaisons, catégories',
  'Règles de taxe, groupes de taxe, taxes',
  'Fabricants et fournisseurs',
];

export default function ResetDataPage() {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleReset() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.delete('/api/import/reset');
      setResult({ success: true, log: res.data.log, errors: res.data.errors });
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Réinitialisation</h1>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2 text-red-600">
          <AlertCircle size={17} /> Suppression complète des données
        </CardTitle>
        <p className="text-sm text-slate-500 mb-3">Cette action supprimera de PrestaShop :</p>
        <ul className="space-y-1 mb-5">
          {SCOPE.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm text-slate-600">
              <Trash2 size={13} className="text-red-400 shrink-0" /> {s}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400 mb-5">Les enregistrements système PrestaShop (catégories racine, taxes par défaut) sont conservés.</p>

        {!confirm ? (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <RotateCcw size={15} /> Réinitialiser toutes les données
          </Button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-red-700">Confirmer la suppression complète de toutes les données PrestaShop ?</p>
            <p className="text-xs text-red-500">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleReset} disabled={loading}>
                <RotateCcw size={14} /> {loading ? 'Suppression...' : 'Oui, tout supprimer'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(false)} disabled={loading}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>

      {result && (
        <Card>
          {result.success ? (
            <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-3">
              <CheckCircle size={18} /> Réinitialisation complète terminée.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 font-semibold mb-3">
              <AlertCircle size={18} /> Erreur : {result.error}
            </div>
          )}
          {result.log?.length > 0 && (
            <pre className="bg-slate-900 text-green-400 text-xs font-mono p-4 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap">
              {result.log.join('\n')}
            </pre>
          )}
          {result.errors?.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ul className="space-y-0.5">
                {result.errors.map((e, i) => <li key={i} className="text-xs text-red-500">{e}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
