import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Trash2, Plus, Minus, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCart } from '../../../context/CartContext.jsx';

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Votre panier est vide</h2>
        <p className="text-gray-500 text-sm mb-6">Ajoutez des produits pour commencer vos achats.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Découvrir les produits
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-black text-gray-900">Mon panier</h1>
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {items.reduce((s, i) => s + i.quantity, 0)} article{items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const price = parseFloat(item.product.price_ttc ?? item.product.price ?? 0);
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-4 px-5 py-4 border-b border-gray-50 last:border-0 items-center"
              >
                {item.product.image ? (
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded-xl bg-gray-100 flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{item.product.name}</p>
                  {item.variant && <p className="text-xs text-gray-400 mt-0.5">{item.variant}</p>}
                  <p className="text-indigo-600 font-semibold text-sm mt-1">{price.toFixed(2)} € / unité</p>
                </div>

                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    className="px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    className="px-3 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>

                <div className="text-right min-w-[70px]">
                  <p className="font-bold text-gray-900 text-sm">{(price * item.quantity).toFixed(2)} €</p>
                </div>

                <button
                  onClick={() => removeItem(item.key)}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-sm">Sous-total</span>
          <span className="font-bold text-gray-900">{total.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 text-sm">Livraison</span>
          <span className="text-emerald-600 font-semibold text-sm">Gratuite</span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-100 pt-4 mb-5">
          <span className="font-bold text-gray-900">Total TTC</span>
          <span className="text-2xl font-black text-indigo-600">{total.toFixed(2)} €</span>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          Valider la commande
          <ArrowRight className="w-4 h-4" />
        </button>
        <Link
          to="/products"
          className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
