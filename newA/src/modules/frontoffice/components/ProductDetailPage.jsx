import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Check, Minus, Plus } from 'lucide-react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList, extractSingle, getLangValue } from '../../../utils/xmlParser.js';
import { loadTaxRateMap, applyTax } from '../../../utils/taxUtils.js';
import { useCart } from '../../../context/CartContext.jsx';
import ProductImages from './ProductImages.jsx';
import DeclinationSelector from './DeclinationSelector.jsx';

const PROXY = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [combinations, setCombinations] = useState([]);
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [baseStock, setBaseStock] = useState(0);
  const [priceTTC, setPriceTTC] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [xml, stockXml, taxRateMap] = await Promise.all([
          prestaGet(`products/${id}`, { output_format: 'XML' }),
          prestaGet('stock_availables', { display: 'full', 'filter[id_product]': id, output_format: 'XML' }),
          loadTaxRateMap(),
        ]);
        const p = extractSingle(parsePrestaXml(xml), 'product');
        if (!p) throw new Error('Produit introuvable');
        setProduct(p);

        const ttc = applyTax(parseFloat(p.price ?? 0), p.id_tax_rules_group, taxRateMap);
        setPriceTTC(ttc);

        const stockList = extractList(parsePrestaXml(stockXml), 'stock_availables');
        const base = stockList.find((s) => String(s.id_product_attribute) === '0');
        setBaseStock(base ? parseInt(base.quantity ?? 0, 10) : 0);

        const comboStocks = stockList.filter((s) => String(s.id_product_attribute) !== '0');
        if (comboStocks.length > 0) {
          const combXml = await prestaGet('combinations', { 'filter[id_product]': id, display: 'full', output_format: 'XML' });
          const combList = extractList(parsePrestaXml(combXml), 'combinations') || [];
          const combMap = {};
          combList.forEach((c) => { combMap[String(c.id)] = c; });
          const rows = comboStocks.map((s) => {
            const comb = combMap[String(s.id_product_attribute)] ?? {};
            const priceOffset = parseFloat(comb.price ?? 0);
            const comboTTC = applyTax(parseFloat(p.price ?? 0) + priceOffset, p.id_tax_rules_group, taxRateMap);
            return {
              id_product_attribute: String(s.id_product_attribute),
              reference: comb.reference || `Déclinaison #${s.id_product_attribute}`,
              quantity: parseInt(s.quantity ?? 0, 10),
              price_ttc: comboTTC,
            };
          });
          setCombinations(rows);
          setSelectedCombo(rows[0] ?? null);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function handleAddToCart() {
    if (!product) return;
    const combo = selectedCombo;
    const effectivePriceTTC = combo ? combo.price_ttc : priceTTC;
    addItem({
      id: product.id,
      name: getLangValue(product.name, 1),
      price_ttc: effectivePriceTTC,
      image: imageUrl,
      id_product_attribute: combo?.id_product_attribute ?? '0',
    }, qty, combo ? combo.reference : null);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error) return <p className="text-red-500 text-sm">Erreur : {error}</p>;
  if (!product) return null;

  const name = getLangValue(product.name, 1);
  const desc = getLangValue(product.description_short, 1) || getLangValue(product.description, 1);
  const imageId = typeof product.id_default_image === 'object'
    ? product.id_default_image?._
    : product.id_default_image;
  const imageUrl = imageId && imageId !== '0'
    ? `${PROXY}/api/presta/images/products/${id}/${imageId}`
    : null;

  const currentPriceTTC = selectedCombo ? selectedCombo.price_ttc : priceTTC;
  const currentStock = combinations.length > 0 ? (selectedCombo?.quantity ?? 0) : baseStock;

  return (
    <div>
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux produits
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <ProductImages imageUrl={imageUrl} name={name} availableDate={product.available_date} />

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          {product.categoryName && (
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">
              {product.categoryName}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-3">{name}</h1>

          <div className="text-3xl font-black text-indigo-600 mb-4">
            {currentPriceTTC.toFixed(2)} €
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className={`w-2 h-2 rounded-full ${currentStock > 0 ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium ${currentStock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {currentStock > 0
                ? `En stock (${currentStock} unité${currentStock > 1 ? 's' : ''})`
                : 'Rupture de stock'}
            </span>
          </div>

          <DeclinationSelector combinations={combinations} selectedCombo={selectedCombo} onSelect={setSelectedCombo} />

          {desc && (
            <div className="text-sm text-gray-600 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: desc }} />
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-bold text-gray-900">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3 hover:bg-gray-50 transition-colors text-gray-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={currentStock === 0}
              className={[
                'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm',
                added
                  ? 'bg-emerald-500 text-white'
                  : currentStock > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {added ? (
                <><Check className="w-4 h-4" />Ajouté !</>
              ) : (
                <><ShoppingBag className="w-4 h-4" />Ajouter au panier</>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">Livraison gratuite · Paiement à la livraison</p>
        </motion.div>
      </div>
    </div>
  );
}
