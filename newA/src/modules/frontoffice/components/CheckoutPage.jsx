import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, User, Truck, CreditCard, Check, ArrowLeft, AlertCircle } from 'lucide-react';
import { useCart } from '../../../context/CartContext.jsx';
import { useUser } from '../../../context/UserContext.jsx';
import { api, prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList, extractId } from '../../../utils/xmlParser.js';
import { buildCartXml, buildOrderXml, buildAddressXml } from '../../../utils/xmlBuilder.js';
import CheckoutSteps from './CheckoutSteps.jsx';
import CheckoutRecap from './CheckoutRecap.jsx';

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!user || user.isAnonymous) {
      setError('Veuillez sélectionner un compte utilisateur pour commander.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let paymentStateId = 11;
      try {
        const configXml = await prestaGet('configurations', {
          'filter[name]': 'PS_OS_PAYMENT',
          display: 'full',
          output_format: 'XML',
        });
        const found = extractList(parsePrestaXml(configXml), 'configurations')
          .find((c) => c.name === 'PS_OS_PAYMENT');
        if (found) paymentStateId = parseInt(found.value, 10) || 11;
      } catch { /* droits insuffisants — garder défaut 11 */ }

      const addrXml = await prestaGet('addresses', {
        display: 'full',
        [`filter[id_customer]`]: user.id,
        output_format: 'XML',
      });
      const addrList = extractList(parsePrestaXml(addrXml), 'addresses');
      let addr = addrList[0];

      if (!addr) {
        const nameParts = user.name.trim().split(' ');
        const firstname = nameParts[0] || 'Client';
        const lastname  = nameParts.slice(1).join(' ') || firstname;
        const newAddrXml = buildAddressXml({
          id_customer: user.id,
          alias: 'Principale',
          address1: 'Adresse par défaut',
          city: 'Antananarivo',
          postcode: '101',
          id_country: 8,
          firstname,
          lastname,
        });
        const addrRes = await api.post('/api/presta/addresses', newAddrXml, {
          headers: { 'Content-Type': 'application/xml' },
        });
        const newAddrId = extractId(parsePrestaXml(addrRes.data), 'address');
        if (!newAddrId) throw new Error('Impossible de créer une adresse pour ce client.');
        addr = { id: newAddrId };
      }

      // ps_cart_product PK is (id_cart, id_product, id_product_attribute, ...).
      // Without combinations, distinct declinations share attribute 0 — merge
      // them by product+attribute (summing qty) to avoid a duplicate-PK crash.
      const cartRowMap = new Map();
      for (const item of items) {
        const pid  = item.product.id;
        const attr = item.product.id_product_attribute ?? 0;
        const key  = `${pid}::${attr}`;
        const existing = cartRowMap.get(key);
        if (existing) existing.quantity += item.quantity;
        else cartRowMap.set(key, { product_id: pid, product_attribute_id: attr, quantity: item.quantity, id_shop: 1 });
      }
      const cartRows = Array.from(cartRowMap.values());
      const cartXml = buildCartXml({
        id_customer:         user.id,
        id_address_delivery: addr.id,
        id_address_invoice:  addr.id,
        cartRows,
      });
      const cartRes = await api.post('/api/presta/carts', cartXml, {
        headers: { 'Content-Type': 'application/xml' },
      });
      const cartId = extractId(parsePrestaXml(cartRes.data), 'cart');
      if (!cartId) throw new Error('Impossible de créer le panier.');

      const orderRows = items.map((item) => {
        const price = parseFloat(item.product.price_ttc ?? item.product.price ?? 0);
        return {
          product_id:           item.product.id,
          product_attribute_id: item.product.id_product_attribute ?? 0,
          product_name:         item.product.name,
          product_reference:    item.product.id,
          quantity:             item.quantity,
          product_price:        price,
          unit_price_tax_incl:  price,
          unit_price_tax_excl:  price,
        };
      });
      const orderXml = buildOrderXml({
        id_customer:         user.id,
        id_cart:             cartId,
        id_address_delivery: addr.id,
        id_address_invoice:  addr.id,
        current_state:       1,
        payment:             'Paiement à la livraison',
        module:              'ps_cashondelivery',
        total_paid:          total.toFixed(2),
        total_paid_real:     total.toFixed(2),
        total_products:      total.toFixed(2),
        total_products_wt:   total.toFixed(2),
        orderRows,
      });
      const orderRes = await api.post('/api/presta/orders', orderXml, {
        headers: { 'Content-Type': 'application/xml' },
      });
      const orderId = extractId(parsePrestaXml(orderRes.data), 'order');
      if (!orderId) throw new Error('Impossible de créer la commande.');

      await api.put(`/api/orders/${orderId}/state`, { current_state: paymentStateId });

      clearCart();
      navigate('/my-orders');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
        <p className="text-gray-500 mb-4">Votre panier est vide.</p>
        <Link to="/products" className="text-indigo-600 font-medium hover:underline text-sm">
          Retour aux produits
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-2xl font-black text-gray-900">Confirmation de commande</h1>
      </div>

      <CheckoutSteps />

      <div className="grid grid-cols-1 gap-4">
        <CheckoutRecap items={items} total={total} />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Livraison</h2>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Livraison standard</span>
            <span className="text-emerald-600 font-semibold">Gratuite</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Paiement</h2>
          </div>
          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border-2 border-indigo-200">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">Paiement à la livraison</p>
              <p className="text-xs text-indigo-500">Vous payez à réception de votre colis</p>
            </div>
          </div>
        </div>

        {user && !user.isAnonymous && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-indigo-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Client</h2>
            </div>
            <p className="text-sm text-gray-700">
              Commande au nom de <strong>{user.name}</strong>
            </p>
          </div>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </motion.div>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={handleConfirm}
          disabled={loading || !user || user.isAnonymous}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Traitement en cours...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirmer la commande
            </>
          )}
        </button>

        {user?.isAnonymous && (
          <p className="text-center text-sm text-red-500">
            Un compte est requis pour commander.{' '}
            <Link to="/" className="font-semibold underline">Choisir un utilisateur</Link>
          </p>
        )}
      </div>
    </div>
  );
}
