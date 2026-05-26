import { useState, useEffect } from 'react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Button } from '../../../shared/ui/Button.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { Lock, Minus, Plus, CheckCircle, AlertCircle, X, ShieldCheck, LockOpen } from 'lucide-react';

const UNLOCK_KEY = 'stock_remove_unlocked';
const REMOVE_SUMMARY_KEY = 'stock_remove_summary_remove';
const ADD_SUMMARY_KEY = 'stock_remove_summary_add';

function loadSummary(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function StockRemovePage() {
  const { DEFAULT_PWD } = useAuth();

  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === 'true');
  const [pwd, setPwd] = useState('');
  const [popup, setPopup] = useState(null);

  const [categories, setCategories] = useState([]);

  // Retrait
  const [selectedCatRemove, setSelectedCatRemove] = useState('');
  const [quantityRemove, setQuantityRemove] = useState(1);

  // Ajout
  const [selectedCatAdd, setSelectedCatAdd] = useState('');
  const [quantityAdd, setQuantityAdd] = useState(1);
  const [limit, setLimit] = useState(''); // vide = pas de limite

  const [loadingRemove, setLoadingRemove] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [error, setError] = useState('');

  const [removeSummary, setRemoveSummary] = useState(() => loadSummary(REMOVE_SUMMARY_KEY));
  const [addSummary, setAddSummary] = useState(() => loadSummary(ADD_SUMMARY_KEY));

  useEffect(() => {
    if (!unlocked) return;
    async function loadCats() {
      try {
        const xml = await prestaGet('categories', { display: 'full', output_format: 'XML' });
        const list = extractList(parsePrestaXml(xml), 'categories')
          .filter((c) => String(c.id) !== '1' && String(c.id) !== '2');
        setCategories(list);
        if (list.length) {
          setSelectedCatRemove(list[0].id);
          setSelectedCatAdd(list[0].id);
        }
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
    sessionStorage.removeItem(REMOVE_SUMMARY_KEY);
    sessionStorage.removeItem(ADD_SUMMARY_KEY);
    setUnlocked(false);
    setRemoveSummary(null);
    setAddSummary(null);
    setPwd('');
  }

  async function handleRemove(e) {
    e.preventDefault();
    setError('');
    setLoadingRemove(true);
    try {
      const res = await api.post('/api/stock/remove-by-category', {
        categoryId: selectedCatRemove,
        quantity: parseInt(quantityRemove, 10),
      });
      setRemoveSummary(res.data);
      sessionStorage.setItem(REMOVE_SUMMARY_KEY, JSON.stringify(res.data));
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoadingRemove(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setLoadingAdd(true);
    try {
      const trimmedLimit = String(limit).trim();
      const res = await api.post('/api/stock/add-by-category', {
        categoryId: selectedCatAdd,
        quantity: parseInt(quantityAdd, 10),
        limit: trimmedLimit === '' ? null : parseInt(trimmedLimit, 10),
      });
      setAddSummary(res.data);
      sessionStorage.setItem(ADD_SUMMARY_KEY, JSON.stringify(res.data));
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoadingAdd(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Stock par catégorie</h1>

        <Card className="max-w-md mx-auto">
          <CardTitle className="mb-4 flex items-center gap-2 text-amber-700">
            <Lock size={17} /> Zone protégée
          </CardTitle>
          <p className="text-sm text-slate-500 mb-4">
            Veuillez saisir le mot de passe administrateur pour accéder à la gestion de stock par catégorie.
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

  const hasSummary = removeSummary || addSummary;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-slate-800">Stock par catégorie</h1>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
          <LockOpen size={12} /> Déverrouillé
        </span>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={handleLock}>
          <Lock size={13} /> Reverrouiller
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* AJOUT par catégorie */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Plus size={16} className="text-emerald-500" /> Ajout par catégorie
        </CardTitle>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Catégorie</label>
            <select
              value={selectedCatAdd}
              onChange={(e) => setSelectedCatAdd(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{getLangValue(c.name, 1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantité à ajouter</label>
            <input
              type="number" min="1" value={quantityAdd}
              onChange={(e) => setQuantityAdd(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Limite max stock <span className="normal-case text-slate-400 font-normal">(vide = aucune)</span>
            </label>
            <input
              type="number" min="0" value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="aucune limite"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <Button type="submit" variant="success" disabled={loadingAdd || !selectedCatAdd} className="w-full justify-center">
            <Plus size={15} /> {loadingAdd ? 'En cours...' : 'Ajouter le stock'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Pour chaque produit : si une limite est fixée, l'ajout est plafonné de sorte que stock ≤ limite. Aucune valeur = pas de plafond.
        </p>
      </Card>

      {/* RETRAIT par catégorie */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Minus size={16} className="text-red-500" /> Retrait par catégorie
        </CardTitle>
        <form onSubmit={handleRemove} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Catégorie</label>
            <select
              value={selectedCatRemove}
              onChange={(e) => setSelectedCatRemove(e.target.value)}
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
              type="number" min="1" value={quantityRemove}
              onChange={(e) => setQuantityRemove(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <Button type="submit" variant="danger" disabled={loadingRemove || !selectedCatRemove} className="w-full justify-center">
            <Minus size={15} /> {loadingRemove ? 'En cours...' : 'Retirer le stock'}
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Pour chaque produit : si stock &gt; n alors retire n, sinon stock = 0 (jamais négatif).
        </p>
      </Card>

      {(loadingRemove || loadingAdd) && <Spinner />}

      {/* Résumé : tableau de 2 lignes (Retrait + Ajout) */}
      {hasSummary && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-emerald-600">
            <CheckCircle size={17} /> Résumé des opérations
          </CardTitle>

          <Table>
            <Thead>
              <tr>
                <Th>Action</Th>
                <Th>Catégorie</Th>
                <Th right>Quantité demandée</Th>
                <Th right>Quantité réelle</Th>
              </tr>
            </Thead>
            <Tbody>
              {removeSummary && (
                <Tr>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      <Minus size={11} /> Retrait
                    </span>
                  </Td>
                  <Td className="font-medium">{removeSummary.categoryName || `#${removeSummary.categoryId}`}</Td>
                  <Td right className="text-slate-500">{removeSummary.requested}</Td>
                  <Td right className="font-bold text-red-500">-{removeSummary.totalApplied}</Td>
                </Tr>
              )}
              {addSummary && (
                <Tr>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      <Plus size={11} /> Ajout
                    </span>
                  </Td>
                  <Td className="font-medium">
                    {addSummary.categoryName || `#${addSummary.categoryId}`}
                    {addSummary.limit !== null && addSummary.limit !== undefined && (
                      <span className="text-slate-400 text-xs ml-2">limite={addSummary.limit}</span>
                    )}
                  </Td>
                  <Td right className="text-slate-500">{addSummary.requested}</Td>
                  <Td right className="font-bold text-emerald-600">+{addSummary.totalApplied}</Td>
                </Tr>
              )}
            </Tbody>
          </Table>

          {/* Détails par produit (collapsé sous le résumé) */}
          {removeSummary && (
            <DetailsBlock title="Détail du retrait" rows={removeSummary.details} variant="remove" />
          )}
          {addSummary && (
            <DetailsBlock title="Détail de l'ajout" rows={addSummary.details} variant="add" />
          )}
        </Card>
      )}
    </div>
  );
}

function DetailsBlock({ title, rows, variant }) {
  if (!rows?.length) return null;
  const isRemove = variant === 'remove';
  return (
    <div className="mt-5">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h4>
      <Table>
        <Thead>
          <tr>
            <Th>Produit</Th>
            <Th right>Stock avant</Th>
            <Th right>{isRemove ? 'Retiré' : 'Ajouté'}</Th>
            <Th right>Stock après</Th>
          </tr>
        </Thead>
        <Tbody>
          {rows.map((d) => {
            const applied = isRemove ? d.removed : d.added;
            return (
              <Tr key={d.productId}>
                <Td className="font-medium">
                  {d.productName}
                  <span className="text-slate-400 text-xs ml-2">id={d.productId}</span>
                </Td>
                <Td right className="text-slate-500">{d.oldQty}</Td>
                <Td right>
                  <span className={`font-bold ${isRemove ? 'text-red-500' : 'text-emerald-600'}`}>
                    {isRemove ? `-${applied}` : `+${applied}`}
                  </span>
                </Td>
                <Td right className="font-semibold">{d.newQty}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
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
