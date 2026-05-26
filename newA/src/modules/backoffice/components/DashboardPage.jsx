import { useState, useEffect } from 'react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList } from '../../../utils/xmlParser.js';
import { isoToFr } from '../../../utils/dateUtils.js';
import { StatCard } from '../../../shared/ui/StatCard.jsx';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { ShoppingCart, Users, Package, Archive, TrendingUp } from 'lucide-react';

async function countResource(resource) {
  try {
    const xml = await prestaGet(resource, { output_format: 'XML' });
    return extractList(parsePrestaXml(xml), resource).length;
  } catch { return 0; }
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [ordersXml, nbCustomers, nbProducts, nbCarts] = await Promise.all([
          prestaGet('orders', { display: 'full', output_format: 'XML' }),
          countResource('customers'),
          countResource('products'),
          countResource('carts'),
        ]);

        const orders = extractList(parsePrestaXml(ordersXml), 'orders');
        const byDay = {};
        let grandTotal = 0;

        orders.forEach((o) => {
          const day = (o.date_add ?? '').split(' ')[0];
          const isPaid = ['2', '3', '5', '11'].includes(String(o.current_state));
          if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
          byDay[day].count++;
          if (isPaid) {
            const amount = parseFloat(o.total_paid ?? 0);
            byDay[day].total += amount;
            grandTotal += amount;
          }
        });

        const days = Object.entries(byDay)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, d]) => ({ date, ...d }));

        setStats({ days, grandTotal, totalOrders: orders.length, nbCustomers, nbProducts, nbCarts });
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Tableau de bord</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Commandes"         value={stats.totalOrders}              icon={ShoppingCart} color="indigo" />
        <StatCard label="Paniers"           value={stats.nbCarts}                  icon={Archive}      color="amber" />
        <StatCard label="Clients"           value={stats.nbCustomers}              icon={Users}        color="blue" />
        <StatCard label="Produits"          value={stats.nbProducts}               icon={Package}      color="emerald" />
        <StatCard label="Chiffre d'affaires" value={`${stats.grandTotal.toFixed(2)} €`} icon={TrendingUp} color="rose" />
      </div>

      <Card>
        <CardTitle className="mb-4">Commandes par jour</CardTitle>
        {stats.days.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune commande.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Nb commandes</Th>
                <Th right>Montant total</Th>
              </tr>
            </Thead>
            <Tbody>
              {stats.days.map((d) => (
                <Tr key={d.date}>
                  <Td className="font-medium">{isoToFr(d.date)}</Td>
                  <Td>{d.count}</Td>
                  <Td right className="font-semibold text-emerald-600">{d.total.toFixed(2)} €</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
