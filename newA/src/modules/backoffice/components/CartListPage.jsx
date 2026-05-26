import { useState, useEffect } from 'react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { isoToFr } from '../../../utils/dateUtils.js';
import { Card } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CartRowExpanded from './CartRowExpanded.jsx';

function customerName(c) {
  const first = typeof c.firstname === 'string' ? c.firstname : (getLangValue(c.firstname) || '');
  const last  = typeof c.lastname  === 'string' ? c.lastname  : (getLangValue(c.lastname)  || '');
  return `${first} ${last}`.trim();
}

export default function CartListPage() {
  const [carts, setCarts] = useState([]);
  const [customerMap, setCustomerMap] = useState({});
  const [productMap, setProductMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);
  const [expandLoading, setExpandLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [cartXml, custXml, prodXml, orderXml] = await Promise.all([
          prestaGet('carts', { display: 'full', output_format: 'XML' }),
          prestaGet('customers', { display: 'full', output_format: 'XML' }),
          prestaGet('products', { display: 'full', output_format: 'XML' }),
          prestaGet('orders', { display: 'full', output_format: 'XML' }),
        ]);

        const paidCartIds = new Set();
        extractList(parsePrestaXml(orderXml), 'orders').forEach((o) => {
          const state = String(o.current_state);
          if (state === '2' || state === '11') paidCartIds.add(String(o.id_cart));
        });

        const allCarts = extractList(parsePrestaXml(cartXml), 'carts');
        setCarts(allCarts.filter((c) => !paidCartIds.has(String(c.id))));

        const cm = {};
        extractList(parsePrestaXml(custXml), 'customers').forEach((c) => { cm[c.id] = customerName(c); });
        setCustomerMap(cm);
        const pm = {};
        extractList(parsePrestaXml(prodXml), 'products').forEach((p) => { pm[p.id] = getLangValue(p.name, 1); });
        setProductMap(pm);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function cartRows(cart) {
    const raw = cart.associations?.cart_rows?.cart_row;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  function totalQty(cart) {
    return cartRows(cart).reduce((s, r) => s + (parseInt(r.quantity, 10) || 0), 0);
  }

  async function toggleExpand(cart) {
    if (expandedId === cart.id) { setExpandedId(null); setExpandedRows([]); return; }
    setExpandedId(cart.id);
    setExpandedRows([]);
    setExpandLoading(true);
    try {
      const rows = cartRows(cart);
      const comboProductIds = [...new Set(
        rows.filter((r) => r.id_product_attribute && r.id_product_attribute !== '0').map((r) => r.id_product)
      )];
      const comboMap = {};
      await Promise.all(comboProductIds.map(async (pid) => {
        try {
          const xml = await prestaGet('combinations', { 'filter[id_product]': pid, display: 'full', output_format: 'XML' });
          (extractList(parsePrestaXml(xml), 'combinations') || []).forEach((c) => {
            comboMap[c.id] = c.reference || `Déclinaison #${c.id}`;
          });
        } catch { /* ignore */ }
      }));
      setExpandedRows(rows.map((r) => ({
        productName: productMap[r.id_product] ?? `Produit #${r.id_product}`,
        variant: r.id_product_attribute && r.id_product_attribute !== '0'
          ? (comboMap[r.id_product_attribute] ?? `Déclinaison #${r.id_product_attribute}`)
          : '',
        quantity: parseInt(r.quantity, 10) || 0,
      })));
    } catch { setExpandedRows([]); }
    finally { setExpandLoading(false); }
  }

  const filtered = carts.filter((c) =>
    (customerMap[c.id_customer] ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Paniers en attente</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card>
        <div className="flex items-center gap-4 mb-5">
          <input
            placeholder="Rechercher par client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-xs text-slate-400">{filtered.length} panier(s)</span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun panier en attente de paiement.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th right>Articles</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {filtered.map((cart) => {
                const isExpanded = expandedId === cart.id;
                const qty = totalQty(cart);
                return [
                  <Tr key={`c-${cart.id}`} onClick={() => toggleExpand(cart)} className={isExpanded ? 'bg-indigo-50' : ''}>
                    <Td className="text-slate-400 text-xs">{cart.id}</Td>
                    <Td className={isExpanded ? 'font-semibold text-indigo-700' : 'font-medium'}>
                      {customerMap[cart.id_customer] ?? `Client #${cart.id_customer}`}
                    </Td>
                    <Td className="text-slate-500">{isoToFr(cart.date_add)}</Td>
                    <Td right>
                      <span className={`font-semibold ${qty === 0 ? 'text-slate-300' : 'text-indigo-600'}`}>{qty}</span>
                    </Td>
                    <Td className="w-8">
                      {isExpanded
                        ? <ChevronUp size={15} className="text-indigo-400" />
                        : <ChevronDown size={15} className="text-slate-300" />}
                    </Td>
                  </Tr>,

                  isExpanded && (
                    <tr key={`x-${cart.id}`} className="bg-indigo-50/60">
                      <td colSpan={5} className="px-0 py-0">
                        <CartRowExpanded expandLoading={expandLoading} expandedRows={expandedRows} />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
