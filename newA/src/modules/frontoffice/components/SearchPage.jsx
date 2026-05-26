import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X, Package } from 'lucide-react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { loadTaxRateMap, applyTax } from '../../../utils/taxUtils.js';
import { parseDecimal } from '../../../utils/csvParser.js';
import ProductCard from '../../../shared/components/ProductCard.jsx';
import SearchFilters from './SearchFilters.jsx';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchPage() {
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState(null);
  const [filters, setFilters] = useState({ name: '', categoryId: '', minPrice: '', maxPrice: '' });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedName = useDebounce(filters.name, 280);

  useEffect(() => {
    async function load() {
      try {
        const [pXml, cXml, taxRateMap] = await Promise.all([
          prestaGet('products', { display: 'full', output_format: 'XML' }),
          prestaGet('categories', { display: 'full', output_format: 'XML' }),
          loadTaxRateMap(),
        ]);
        const pList = extractList(parsePrestaXml(pXml), 'products');
        const cList = extractList(parsePrestaXml(cXml), 'categories');
        const catMap = {};
        cList.forEach((c) => { catMap[c.id] = getLangValue(c.name, 1); });
        const enriched = pList.map((p) => ({
          ...p,
          categoryName: catMap[p.id_category_default] ?? '',
          price_ttc: applyTax(parseFloat(p.price ?? 0), p.id_tax_rules_group, taxRateMap),
        }));
        setAllProducts(enriched);
        setCategories(cList.filter((c) => c.id !== '1' && c.id !== '2'));
      } catch (_) {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  const runSearch = useCallback((f) => {
    const { name, categoryId, minPrice, maxPrice } = f;
    if (!name.trim() && !categoryId && minPrice === '' && maxPrice === '') {
      setResults(null);
      return;
    }
    let res = allProducts;
    if (name.trim()) {
      const q = name.trim().toLowerCase();
      res = res.filter((p) => getLangValue(p.name, 1).toLowerCase().includes(q));
    }
    if (categoryId) {
      res = res.filter((p) => String(p.id_category_default) === String(categoryId));
    }
    const min = parseDecimal(minPrice);
    const max = parseDecimal(maxPrice);
    if (minPrice !== '') res = res.filter((p) => p.price_ttc >= min);
    if (maxPrice !== '') res = res.filter((p) => p.price_ttc <= max);
    setResults(res);
  }, [allProducts]);

  useEffect(() => {
    runSearch({ ...filters, name: debouncedName });
  }, [debouncedName, filters.categoryId, filters.minPrice, filters.maxPrice, runSearch]);

  function clearFilters() {
    setFilters({ name: '', categoryId: '', minPrice: '', maxPrice: '' });
    setResults(null);
  }

  const hasActiveFilters = filters.name || filters.categoryId || filters.minPrice || filters.maxPrice;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">Recherche</h1>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={filters.name}
          onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
          className="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-2xl bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
          autoFocus
        />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${showFilters ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400'}`}
          title="Filtres avancés"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      <SearchFilters filters={filters} setFilters={setFilters} categories={categories} showFilters={showFilters} />

      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {filters.name && (
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-200">
              "{filters.name}"
            </span>
          )}
          {filters.categoryId && (
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-200">
              {getLangValue(categories.find((c) => c.id === filters.categoryId)?.name, 1) || 'Catégorie'}
            </span>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-200">
              {filters.minPrice || '0'} – {filters.maxPrice || '∞'} €
            </span>
          )}
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3 h-3" />
            Effacer
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results === null ? (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Tapez un mot-clé pour chercher un produit</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucun produit ne correspond à votre recherche.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
