import { useState, useEffect } from 'react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList } from '../../../utils/xmlParser.js';
import StockForm from './StockForm.jsx';
import StockList from './StockList.jsx';

export default function StockAddPage() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('');
  const [delta, setDelta] = useState(1);
  const [combinations, setCombinations] = useState([]);
  const [selectedCombination, setSelectedCombination] = useState('0');
  const [stockTotals, setStockTotals] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [prodXml, stockXml] = await Promise.all([
          prestaGet('products', { display: 'full', output_format: 'XML' }),
          prestaGet('stock_availables', { display: 'full', output_format: 'XML' }),
        ]);
        const list = extractList(parsePrestaXml(prodXml), 'products');
        setProducts(list);
        if (list.length) setSelected(list[0].id);

        const saList = extractList(parsePrestaXml(stockXml), 'stock_availables');
        const byProduct = {};
        saList.forEach((sa) => {
          const pid = String(sa.id_product);
          if (!byProduct[pid]) byProduct[pid] = [];
          byProduct[pid].push(sa);
        });
        const totals = {};
        Object.entries(byProduct).forEach(([pid, entries]) => {
          const combEntries = entries.filter((sa) => String(sa.id_product_attribute ?? '0') !== '0');
          if (combEntries.length > 0) {
            totals[pid] = combEntries.reduce((sum, sa) => sum + (parseInt(sa.quantity, 10) || 0), 0);
          } else {
            totals[pid] = parseInt(entries[0]?.quantity ?? 0, 10) || 0;
          }
        });
        setStockTotals(totals);
      } catch (e) { setError(e.message); }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadCombinations() {
      if (!selected) return;
      try {
        const xml = await prestaGet('combinations', { 'filter[id_product]': selected, display: 'full', output_format: 'XML' });
        setCombinations(extractList(parsePrestaXml(xml), 'combinations') || []);
        setSelectedCombination('0');
      } catch { setCombinations([]); }
    }
    loadCombinations();
  }, [selected]);

  async function toggleExpand(productId) {
    if (expandedId === productId) { setExpandedId(null); setExpandedRows([]); return; }
    setExpandedId(productId);
    setExpandedRows([]);
    setExpandLoading(true);
    try {
      const [combXml, stockXml] = await Promise.all([
        prestaGet('combinations', { 'filter[id_product]': productId, display: 'full', output_format: 'XML' }),
        prestaGet('stock_availables', { 'filter[id_product]': productId, display: 'full', output_format: 'XML' }),
      ]);
      const combList = extractList(parsePrestaXml(combXml), 'combinations') || [];
      const stockList = extractList(parsePrestaXml(stockXml), 'stock_availables') || [];
      const stockMap = {};
      stockList.forEach((s) => { stockMap[String(s.id_product_attribute ?? '0')] = parseInt(s.quantity ?? 0, 10); });
      const rows = combList.length === 0
        ? [{ label: 'Produit simple', quantity: stockMap['0'] ?? 0 }]
        : combList.map((c) => ({
            label: c.reference ? `${c.reference} (id=${c.id})` : `Déclinaison #${c.id}`,
            quantity: stockMap[String(c.id)] ?? 0,
          }));
      setExpandedRows(rows);
    } catch { setExpandedRows([]); }
    finally { setExpandLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const body = { productId: selected, delta: parseInt(delta, 10) };
      if (selectedCombination === 'all') body.applyToAll = true;
      else if (selectedCombination !== '0') body.productAttributeId = selectedCombination;
      const res = await api.post('/api/stock/add', body);
      setResult(res.data);
      if (expandedId === selected) { setExpandedId(null); setTimeout(() => toggleExpand(selected), 300); }
    } catch (e) { setError(e.response?.data?.error ?? e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Stock</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <StockForm
        products={products} selected={selected} setSelected={setSelected}
        delta={delta} setDelta={setDelta} combinations={combinations}
        selectedCombination={selectedCombination} setSelectedCombination={setSelectedCombination}
        loading={loading} result={result} onSubmit={handleSubmit}
      />

      <StockList
        products={products} search={search} setSearch={setSearch}
        stockTotals={stockTotals} expandedId={expandedId} expandedRows={expandedRows}
        expandLoading={expandLoading} onToggleExpand={toggleExpand}
      />
    </div>
  );
}
