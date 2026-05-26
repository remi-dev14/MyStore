import { useState, useEffect } from 'react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { Lock, Minus, CheckCircle, AlertCircle, X, ShieldCheck, LockOpen } from 'lucide-react';

const UNLOCK_KEY = 'stock_remove_unlocked';
const SUMMARY_KEY = 'stock_remove_summary';

export default function StockRemovePage() {
  const { DEFAULT_PWD } = useAuth();

  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === 'true');
  const [pwd, setPwd] = useState('');
  const [popup, setPopup] = useState(null);

  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SUMMARY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!unlocked) return;
    async function loadCats() {
      try {
        const xml = await prestaGet('categories', { display: 'full', output_format: 'XML' });
        const list = extractList(parsePrestaXml(xml), 'categories')
          .filter((c) => String(c.id) !== '1' && String(c.id) !== '2');
        setCategories(list);
        if (list.length) setSelectedCat(list[0].id);
      } catch (e) { setError(e.message); }
    }
    loadCats();
  }, [unlocked]);

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (pwd === DEFAULT_PWD) {
      setPopup({ type: 'success', message: 'Mot de passe correct. Accès autorisé.' });
      setTimeout(() => {
        setPopup(null);
        sessionStorage.setItem(UNLOCK_KEY, 'true');
        setUnlocked(true);
      }, 900);
    } else {
      setPopup({ type: 'error', message: 'Mot de passe incorrect' });
    }
  }

  function handleLock() {
    sessionStorage.removeItem(UNLOCK_KEY);
    sessionStorage.removeItem(SUMMARY_KEY);
    setUnlocked(false);
    setSummary(null);
    setPwd('');
  }

  async function handleRemove(e) {
    e.preventDefault();
    setError('');
    setSummary(null);
    sessionStorage.removeItem(SUMMARY_KEY);
    setLoading(true);
    try {
      const res = await api.post('/api/stock/remove-by-category', {
        categoryId: selectedCat,
        quantity: parseInt(quantity, 10),
      });
      setSummary(res.data);
      sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(res.data));
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Retirer du stock</h1>

        <Card className="max-w-md mx-auto">
          <CardTitle className="mb-4 flex items-center gap-2 text-amber-700">
            <Lock size={17} /> Zone protégée
          </CardTitle>
          <p className="text-sm text-slate-500 mb-4">
            Veuillez saisir le mot de passe administrateur pour accéder à la suppression de stock.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Mot de passe admin"
              autoFocus
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <Button type="submit" className="w-full justify-center">
              <ShieldCheck size={15} /> Valider
            </Button>
          </form>
        </Card>

        {popup && <Popup popup={popup} onClose={() => setPopup(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-slate-800">Retirer du stock</h1>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
          <LockOpen size={12} /> Déverrouillé
        </span>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleLock}>
          <Lock size={13} /> Reverrouiller
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Minus size={16} className="text-red-500" /> Retrait par catégorie
        </CardTitle>
        <form onSubmit={handleRemove} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Catégorie</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{getLangValue(c.name, 1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantité à retirer (n)</label>
            <input
              type="number" min="1" value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <Button type="submit" variant="danger" disabled={loading || !selectedCat} className="w-full justify-center">
            <Minus size={15} /> {loading ? 'En cours...' : 'Retirer le stock'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Pour chaque produit de la catégorie : si stock &gt; n alors retire n, sinon stock = 0.
        </p>
      </Card>

      {loading && <Spinner />}

      {summary && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-emerald-600">
            <CheckCircle size={17} /> Résumé des quantités retirées
          </CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <Stat label="Catégorie" value={summary.categoryName || `#${summary.categoryId}`} />
            <Stat label="Quantité demandée (n)" value={summary.requested} />
            <Stat label="Total retiré" value={summary.totalRemoved} highlight />
          </div>

          <Table>
            <Thead>
              <tr>
                <Th>Produit</Th>
                <Th right>Stock avant</Th>
                <Th right>Retiré</Th>
                <Th right>Stock après</Th>
              </tr>
            </Thead>
            <Tbody>
              {summary.details.map((d) => (
                <Tr key={d.productId}>
                  <Td className="font-medium">
                    {d.productName}
                    <span className="text-slate-400 text-xs ml-2">id={d.productId}</span>
                  </Td>
                  <Td right className="text-slate-500">{d.oldQty}</Td>
                  <Td right>
                    <span className="font-bold text-red-500">-{d.removed}</span>
                  </Td>
                  <Td right className="font-semibold">{d.newQty}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            <strong>Somme exacte des quantités retirées : {summary.totalRemoved}</strong>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
      <p className={`text-lg font-bold mt-1 ${highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Popup({ popup, onClose }) {
  const isSuccess = popup.type === 'success';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
        <div className={`flex items-center gap-3 mb-2 ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}>
          {isSuccess ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
          <h3 className="text-base font-bold">{isSuccess ? 'Accès autorisé' : 'Échec'}</h3>
        </div>
        <p className="text-sm text-slate-600">{popup.message}</p>
      </div>
    </div>
  );
}
