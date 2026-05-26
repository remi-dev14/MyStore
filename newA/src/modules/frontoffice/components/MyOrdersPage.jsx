import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, ShoppingBag, Clock, CheckCircle, XCircle, Truck, Copy, ChevronRight } from 'lucide-react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList } from '../../../utils/xmlParser.js';
import { useUser } from '../../../context/UserContext.jsx';
import { isoToFr } from '../../../utils/dateUtils.js';

const STATE_CONFIG = {
  1:  { label: 'En attente',         icon: Clock,        color: 'text-amber-600 bg-amber-50 border-amber-200' },
  2:  { label: 'Paiement effectué',  icon: CheckCircle,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  3:  { label: 'En préparation',     icon: Package,      color: 'text-blue-600 bg-blue-50 border-blue-200' },
  4:  { label: 'Expédié',            icon: Truck,        color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  5:  { label: 'Livré',              icon: CheckCircle,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  6:  { label: 'Annulé',             icon: XCircle,      color: 'text-red-500 bg-red-50 border-red-200' },
  8:  { label: 'Erreur de paiement', icon: XCircle,      color: 'text-red-500 bg-red-50 border-red-200' },
  11: { label: 'Paiement effectué',  icon: CheckCircle,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

function StateTag({ state }) {
  const s = STATE_CONFIG[state] ?? { label: `État ${state}`, icon: Clock, color: 'text-gray-500 bg-gray-50 border-gray-200' };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

export default function MyOrdersPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dupFor, setDupFor] = useState(null);
  const [dupCount, setDupCount] = useState(1);
  const [dupBusy, setDupBusy] = useState(false);

  async function fetchOrders() {
    if (!user || user.isAnonymous) return [];
    const xml = await prestaGet('orders', {
      display: 'full',
      [`filter[id_customer]`]: user.id,
      output_format: 'XML',
    });
    return extractList(parsePrestaXml(xml), 'orders');
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await fetchOrders();
        if (active) setOrders(list);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleDuplicate(orderId) {
    setDupBusy(true);
    try {
      const n = Math.min(Math.max(parseInt(dupCount, 10) || 1, 1), 20);
      await api.post(`/api/orders/${orderId}/duplicate`, { count: n });
      const list = await fetchOrders();
      setOrders(list);
      setDupFor(null);
      setDupCount(1);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setDupBusy(false);
    }
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Connexion requise</h2>
        <p className="text-gray-500 text-sm mb-5">Connectez-vous pour accéder à vos commandes.</p>
        <Link
          to="/"
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
        >
          Choisir un utilisateur
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">Erreur : {error}</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-black text-gray-900">Mes commandes</h1>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        {user.name} · {orders.length} commande{orders.length !== 1 ? 's' : ''}
      </p>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">Aucune commande pour le moment.</p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            Commencer mes achats
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o, idx) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/my-orders/${o.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/my-orders/${o.id}`); }}
                className="px-5 py-4 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900 text-sm">
                      {o.reference ?? `#${o.id}`}
                    </span>
                    <StateTag state={parseInt(o.current_state)} />
                  </div>
                  <p className="text-xs text-gray-400">{isoToFr(o.date_add)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-indigo-600">
                    {parseFloat(o.total_paid ?? 0).toFixed(2)} €
                  </p>
                  <p className="text-xs text-gray-400">TTC</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>

              <div className="border-t border-gray-50 px-5 py-2.5 flex items-center justify-end gap-3">
                {dupFor === o.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <label className="text-xs text-gray-500">Nombre :</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={dupCount}
                      onChange={(e) => setDupCount(e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button
                      onClick={() => handleDuplicate(o.id)}
                      disabled={dupBusy}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {dupBusy ? 'Duplication…' : 'Confirmer'}
                    </button>
                    <button
                      onClick={() => { setDupFor(null); setDupCount(1); }}
                      disabled={dupBusy}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setDupFor(o.id); setDupCount(1); }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Dupliquer
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
