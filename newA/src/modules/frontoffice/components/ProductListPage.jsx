import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Package } from 'lucide-react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { loadTaxRateMap, applyTax } from '../../../utils/taxUtils.js';
import ProductCard from '../../../shared/components/ProductCard.jsx';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
};

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [pXml, catXml, taxRateMap] = await Promise.all([
          prestaGet('products', { display: 'full', output_format: 'XML' }),
          prestaGet('categories', { display: 'full', output_format: 'XML' }),
          loadTaxRateMap(),
        ]);
        const catList = extractList(parsePrestaXml(catXml), 'categories');
        const catMap = {};
        catList.forEach((c) => { catMap[c.id] = getLangValue(c.name, 1); });
        const list = extractList(parsePrestaXml(pXml), 'products').map((p) => ({
          ...p,
          categoryName: catMap[p.id_category_default] ?? '',
          price_ttc: applyTax(parseFloat(p.price ?? 0), p.id_tax_rules_group, taxRateMap),
        }));
        setProducts(list);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 text-white mb-10 px-8 py-12">
        <div className="relative z-10 max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-black leading-tight mb-3"
          >
            Nos produits
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-indigo-100 mb-5 text-sm sm:text-base"
          >
            Découvrez notre catalogue et commandez en quelques clics.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link
              to="/search"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-indigo-50 transition-colors shadow-sm"
            >
              <Search className="w-4 h-4" />
              Rechercher un produit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <Package className="w-48 h-48 text-white" />
        </div>
      </div>

      {/* Grid */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
          Erreur : {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-5 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">Aucun produit disponible.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">{products.length} produit{products.length > 1 ? 's' : ''}</p>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {products.map((p) => (
              <motion.div key={p.id} variants={item}>
                <ProductCard product={p} />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
