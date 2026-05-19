import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Tag } from 'lucide-react';
import Badge from './Badge.jsx';
import { getLangValue } from '../../utils/xmlParser.js';
import { useCart } from '../../context/CartContext.jsx';

const PROXY = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const name = getLangValue(product.name, 1) || 'Produit';
  const priceTTC = product.price_ttc ?? parseFloat(product.price ?? 0);
  const imageId = typeof product.id_default_image === 'object'
    ? product.id_default_image?._
    : product.id_default_image;
  const imageUrl = imageId && imageId !== '0'
    ? `${PROXY}/api/presta/images/products/${product.id}/${imageId}`
    : null;

  function handleQuickAdd(e) {
    e.stopPropagation();
    addItem({
      id: product.id,
      name,
      price_ttc: priceTTC,
      image: imageUrl,
      id_product_attribute: '0',
    }, 1, null);
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => navigate(`/product/${product.id}`)}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer border border-gray-100"
    >
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-10 h-10 text-gray-200" />
          </div>
        )}
        {product.available_date && (
          <div className="absolute top-3 left-3">
            <Badge availableDate={product.available_date} />
          </div>
        )}
        <button
          onClick={handleQuickAdd}
          className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-indigo-600 p-2.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-indigo-600 hover:text-white active:scale-95"
          title="Ajouter au panier"
        >
          <ShoppingBag className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {product.categoryName && (
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-1">
            {product.categoryName}
          </p>
        )}
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-2">{name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-black text-gray-900">{priceTTC.toFixed(2)} €</span>
        </div>
      </div>
    </motion.div>
  );
}
