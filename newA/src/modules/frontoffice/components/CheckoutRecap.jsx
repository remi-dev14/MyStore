import { ShoppingBag } from 'lucide-react';

export default function CheckoutRecap({ items, total }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag className="w-4 h-4 text-indigo-500" />
        <h2 className="font-semibold text-gray-900 text-sm">Récapitulatif</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const price = parseFloat(item.product.price_ttc ?? item.product.price ?? 0);
          return (
            <div key={item.key} className="flex justify-between items-center text-sm">
              <span className="text-gray-700">
                {item.product.name}
                {item.variant && <span className="text-gray-400"> ({item.variant})</span>}
                <span className="text-gray-400 ml-1">× {item.quantity}</span>
              </span>
              <span className="font-semibold text-gray-900">{(price * item.quantity).toFixed(2)} €</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-center">
        <span className="font-bold text-gray-900">Total TTC</span>
        <span className="text-xl font-black text-indigo-600">{total.toFixed(2)} €</span>
      </div>
    </div>
  );
}
