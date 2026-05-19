import { motion, AnimatePresence } from 'framer-motion';
import { getLangValue } from '../../../utils/xmlParser.js';

export default function SearchFilters({ filters, setFilters, categories, showFilters }) {
  return (
    <AnimatePresence>
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Catégorie</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">Toutes les catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{getLangValue(c.name, 1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Prix min (€)</label>
              <input
                type="number" min="0" step="0.01" placeholder="0"
                value={filters.minPrice}
                onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Prix max (€)</label>
              <input
                type="number" min="0" step="0.01" placeholder="999"
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
