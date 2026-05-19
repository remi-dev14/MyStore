import { useState, useEffect } from 'react';
import { prestaGet, api } from '../../../config/api.js';
import { parsePrestaXml, extractList, getLangValue } from '../../../utils/xmlParser.js';
import { Card } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import OrderRow from './OrderRow.jsx';

function customerName(c) {
  const first = typeof c.firstname === 'string' ? c.firstname : (getLangValue(c.firstname) || '');
  const last  = typeof c.lastname  === 'string' ? c.lastname  : (getLangValue(c.lastname)  || '');
  return `${first} ${last}`.trim();
}

export default function OrdersManagePage() {
  const [orders,      setOrders]      = useState([]);
  const [customerMap, setCustomerMap] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState(null);
  const [error,       setError]       = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [ordersXml, custXml] = await Promise.all([
          prestaGet('orders',    { display: 'full', output_format: 'XML' }),
          prestaGet('customers', { display: 'full', output_format: 'XML' }),
        ]);
        setOrders(extractList(parsePrestaXml(ordersXml), 'orders'));
        const map = {};
        extractList(parsePrestaXml(custXml), 'customers').forEach((c) => { map[c.id] = customerName(c); });
        setCustomerMap(map);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleStateChange(orderId, newState) {
    setUpdating(orderId);
    try {
      await api.put(`/api/orders/${orderId}/state`, { current_state: newState });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, current_state: String(newState) } : o));
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Commandes</h1>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Card>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune commande trouvée.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Référence</Th>
                <Th>Client</Th>
                <Th>Date</Th>
                <Th right>Total TTC</Th>
                <Th>État</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} customerMap={customerMap} updating={updating} onStateChange={handleStateChange} />
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
