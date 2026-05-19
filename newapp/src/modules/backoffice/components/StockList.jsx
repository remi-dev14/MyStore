import { Card, CardTitle } from '../../../shared/ui/Card.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../../shared/ui/Table.jsx';
import { getLangValue } from '../../../utils/xmlParser.js';
import { ChevronDown, ChevronUp, Box } from 'lucide-react';

export default function StockList({ products, search, setSearch, stockTotals, expandedId, expandedRows, expandLoading, onToggleExpand }) {
  const filtered = products.filter((p) =>
    getLangValue(p.name, 1).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <div className="flex items-center gap-4 mb-5">
        <CardTitle className="flex items-center gap-2"><Box size={16} className="text-indigo-500" /> Liste du stock</CardTitle>
        <div className="flex-1" />
        <input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Produit</Th>
            <Th right>Stock total</Th>
            <Th className="w-10"></Th>
          </tr>
        </Thead>
        <Tbody>
          {filtered.map((p) => {
            const isExpanded = expandedId === p.id;
            const total = stockTotals[String(p.id)] ?? 0;
            return [
              <Tr key={`r-${p.id}`} onClick={() => onToggleExpand(p.id)} className={isExpanded ? 'bg-indigo-50' : ''}>
                <Td className={isExpanded ? 'font-semibold text-indigo-700' : 'font-medium'}>
                  {getLangValue(p.name, 1)}
                  <span className="text-slate-400 text-xs ml-2">id={p.id}</span>
                </Td>
                <Td right>
                  <span className={`font-bold ${total === 0 ? 'text-red-400' : 'text-emerald-600'}`}>{total}</span>
                </Td>
                <Td className="w-10 text-center">
                  {isExpanded
                    ? <ChevronUp size={15} className="text-indigo-400" />
                    : <ChevronDown size={15} className="text-slate-300" />}
                </Td>
              </Tr>,

              isExpanded && (
                <tr key={`x-${p.id}`} className="bg-indigo-50/60">
                  <td colSpan={3} className="px-0 py-0">
                    {expandLoading ? (
                      <p className="text-xs text-slate-400 italic px-8 py-3">Chargement...</p>
                    ) : (
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-100/60">
                            <th className="text-left px-8 py-2 text-indigo-600 font-semibold">Déclinaison</th>
                            <th className="text-right px-6 py-2 text-indigo-600 font-semibold w-28">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedRows.map((row, i) => (
                            <tr key={i} className="border-t border-indigo-100">
                              <td className="px-8 py-2 font-medium text-slate-600">{row.label}</td>
                              <td className={`px-6 py-2 text-right font-bold ${row.quantity === 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                                {row.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              ),
            ];
          })}
        </Tbody>
      </Table>

      {filtered.length === 0 && <p className="text-sm text-slate-400 mt-4">Aucun produit.</p>}
    </Card>
  );
}
