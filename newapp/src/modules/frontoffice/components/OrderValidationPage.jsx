import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, CheckCircle, Truck, AlertCircle, Clock, XCircle } from 'lucide-react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractSingle } from '../../../utils/xmlParser.js';
import { useUser } from '../../../context/UserContext.jsx';
import { isoToFr } from '../../../utils/dateUtils.js';

const PS_STATE_DELIVERED = 5;

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

function asList(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export default function OrderValidationPage() {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const xml = await prestaGet(`orders/${id}`, { display: 'full', output_format: 'XML' });
        const o = extractSingle(parsePrestaXml(xml), 'order');
        if (!o) throw new Error('Commande introuvable.');
        setOrder(o);
      } catch (e) {
        setError(e.response?.data?.error ?? e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleConfirmDelivery() {
    setConfirming(true);
    setError('');
    try {
      await api.put(`/api/orders/${id}/state`, { current_state: PS_STATE_DELIVERED });
      setOrder((prev) => ({ ...prev, current_state: String(PS_STATE_DELIVERED) }));
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setConfirming(false);
    }
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-2">Connexion requise</h2>
        <p className="text-gray-500 text-sm">Connectez-vous pour accéder à cette commande.</p>
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

  if (error && !order) {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/my-orders')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Mes commandes
        </button>
        <p className="text-red-500 text-sm">Erreur : {error}</p>
      </div>
    );
  }

  const state = parseInt(order.current_state, 10);
  const rows = asList(order.associations?.order_rows?.order_row);
  const isDelivered = state === PS_STATE_DELIVERED;
  const isCancelled = state === 6;
  const canConfirm = !isDelivered && !isCancelled;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/my-orders')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Mes commandes
      </button>

      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-black text-gray-900">
          {order.reference ?? `Commande #${order.id}`}
        </h1>
        <StateTag state={state} />
      </div>
      <p className="text-sm text-gray-400 mb-6">{isoToFr(order.date_add)}</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-500" /> Détails de la commande
        </h2>
        <div className="divide-y divide-gray-50">
          {rows.map((r, i) => {
            const qty = parseInt(r.product_quantity ?? r.quantity ?? 1, 10);
            const unit = parseFloat(r.unit_price_tax_incl ?? r.product_price ?? 0);
            return (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.product_name || r.product_reference || `Produit #${r.product_id}`}</p>
                  <p className="text-xs text-gray-400">{qty} × {unit.toFixed(2)} €</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{(qty * unit).toFixed(2)} €</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between pt-4 mt-1 border-t border-gray-100">
          <span className="text-sm font-bold text-gray-900">Total TTC</span>
          <span className="text-lg font-black text-indigo-600">{parseFloat(order.total_paid ?? 0).toFixed(2)} €</span>
        </div>
      </div>

      {error && order && (
        <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm"
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Commande confirmée comme livrée. Merci !
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-1 flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-500" /> Validation de réception
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          {isDelivered
            ? 'Cette commande a été marquée comme livrée.'
            : isCancelled
            ? 'Cette commande est annulée et ne peut pas être validée.'
            : 'Confirmez que vous avez bien reçu votre commande.'}
        </p>
        <button
          onClick={handleConfirmDelivery}
          disabled={!canConfirm || confirming}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {confirming ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Validation en cours…
            </>
          ) : isDelivered ? (
            <>
              <CheckCircle className="w-4 h-4" /> Commande livrée
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" /> Valider la réception (Livré)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
