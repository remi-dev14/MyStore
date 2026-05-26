import { useState, useEffect } from 'react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { isoToFr } from '../../../utils/dateUtils.js';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { Badge } from '../../../shared/ui/Badge.jsx';
import { History } from 'lucide-react';

export default function StockHistoryPage() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const xml = await prestaGet('products', { display: 'full', output_format: 'XML' });
        const list = extractList(parsePrestaXml(xml), 'products');
        setProducts(list);
        if (list.length) setSelected(list[0].id);
      } catch (e) { setError(e.message); }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/api/stock/history/${selected}`)
      .then((res) => setHistory(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Historique du stock</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Card>
        <div className="flex items-center gap-4 mb-5">
          <CardTitle className="flex items-center gap-2">
            <History size={16} className="text-indigo-500" /> Produit
          </CardTitle>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{getLangValue(p.name, 1)}</option>
            ))}
          </select>
        </div>

        {loading ? <Spinner /> : history.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun mouvement de stock enregistré.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th right>Mouvement</Th>
                <Th right>Avant</Th>
                <Th right>Après</Th>
              </tr>
            </Thead>
            <Tbody>
              {history.map((h, i) => (
                <Tr key={i}>
                  <Td className="text-slate-500">{isoToFr(h.date)}</Td>
                  <Td right>
                    <Badge variant={h.delta > 0 ? 'success' : 'danger'}>
                      {h.delta > 0 ? `+${h.delta}` : h.delta}
                    </Badge>
                  </Td>
                  <Td right className="text-slate-500">{h.oldQty}</Td>
                  <Td right className="font-semibold">{h.newQty}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
