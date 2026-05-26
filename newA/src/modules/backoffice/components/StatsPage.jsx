import { useState, useEffect } from 'react';
import { api } from '../../../config/api.js';
import { StatCard } from '../../../shared/ui/StatCard.jsx';
import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { Spinner } from '../../../shared/ui/Spinner.jsx';
import { TrendingUp, ShoppingCart, TrendingDown, Package, BarChart2 } from 'lucide-react';

function ProfitCell({ value }) {
  const color = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-500' : 'text-slate-400';
  return <span className={`font-semibold ${color}`}>{value.toFixed(2)} €</span>;
}

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/stats/overview')
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-500 text-sm">Erreur : {error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Statistiques</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total ventes HT"
          value={`${data.totalSalesHT.toFixed(2)} €`}
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard
          label="Total achats HT"
          value={`${data.totalPurchasesHT.toFixed(2)} €`}
          icon={ShoppingCart}
          color="amber"
        />
        <StatCard
          label="Bénéfice total"
          value={`${data.totalProfit.toFixed(2)} €`}
          icon={data.totalProfit >= 0 ? TrendingUp : TrendingDown}
          color={data.totalProfit >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Profit by category */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          Ventes / Achats / Bénéfice par catégorie
        </CardTitle>
        {data.profitByCategory.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune vente enregistrée.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Catégorie</Th>
                <Th right>Qté vendue</Th>
                <Th right>Ventes HT</Th>
                <Th right>Achats HT</Th>
                <Th right>Bénéfice</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.profitByCategory.map((row) => (
                <Tr key={row.categoryId}>
                  <Td className="font-medium">{row.categoryName}</Td>
                  <Td right>{row.qtySold}</Td>
                  <Td right className="text-slate-700">{row.salesHT.toFixed(2)} €</Td>
                  <Td right className="text-slate-500">{row.purchasesHT.toFixed(2)} €</Td>
                  <Td right><ProfitCell value={row.profit} /></Td>
                </Tr>
              ))}
              {/* Totals row */}
              <Tr className="border-t-2 border-slate-200 bg-slate-50">
                <Td className="font-bold text-slate-700">Total</Td>
                <Td right className="font-bold">
                  {data.profitByCategory.reduce((s, r) => s + r.qtySold, 0)}
                </Td>
                <Td right className="font-bold text-slate-700">
                  {data.totalSalesHT.toFixed(2)} €
                </Td>
                <Td right className="font-bold text-slate-500">
                  {data.totalPurchasesHT.toFixed(2)} €
                </Td>
                <Td right>
                  <ProfitCell value={data.totalProfit} />
                </Td>
              </Tr>
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Stock by category */}
      <Card>
        <CardTitle className="mb-4 flex items-center gap-2">
          <Package size={16} className="text-indigo-500" />
          Stock par catégorie
        </CardTitle>
        {data.stockByCategory.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune donnée de stock.</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Catégorie</Th>
                <Th right>Qté physique</Th>
                <Th right>Qté réservée</Th>
                <Th right>Qté disponible</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.stockByCategory.map((row) => (
                <Tr key={row.categoryId}>
                  <Td className="font-medium">{row.categoryName}</Td>
                  <Td right>{row.qtyPhysical}</Td>
                  <Td right className="text-amber-600">{row.qtyReserved}</Td>
                  <Td right>
                    <span className={row.qtyAvailable === 0 ? 'text-red-400 font-semibold' : 'text-emerald-600 font-semibold'}>
                      {row.qtyAvailable}
                    </span>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
