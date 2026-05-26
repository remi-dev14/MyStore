import { CheckCircle, AlertCircle } from 'lucide-react';

export default function ImportResult({ result }) {
  if (!result) return null;

  return (
    <>
      {result.success ? (
        <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-3">
          <CheckCircle size={18} /> Import terminé ({result.log?.length ?? 0} opérations)
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-600 font-semibold mb-3">
          <AlertCircle size={18} /> Erreur : {result.error}
        </div>
      )}
      {result.log?.length > 0 && (
        <pre className="bg-slate-900 text-green-400 text-xs font-mono p-4 rounded-lg max-h-72 overflow-y-auto whitespace-pre-wrap">
          {result.log.join('\n')}
        </pre>
      )}
      {result.errors?.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-semibold text-red-600 mb-1">Erreurs d'import :</p>
          <ul className="space-y-0.5">
            {result.errors.map((e, i) => <li key={i} className="text-xs text-red-500">{e}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
