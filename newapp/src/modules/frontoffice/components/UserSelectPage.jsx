import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ChevronRight, ShoppingBag } from 'lucide-react';
import { prestaGet } from '../../../config/api.js';
import { parsePrestaXml, extractList } from '../../../utils/xmlParser.js';
import { useUser } from '../../../context/UserContext.jsx';
import UserCard from './UserCard.jsx';

export default function UserSelectPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { selectUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const xml = await prestaGet('customers', { display: 'full', output_format: 'XML' });
        setCustomers(extractList(parsePrestaXml(xml), 'customers'));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleSelect(customer) {
    const name = `${customer.firstname ?? ''} ${customer.lastname ?? ''}`.trim() || `Client #${customer.id}`;
    selectUser({ id: customer.id, name, email: customer.email, isAnonymous: false });
    navigate('/products');
  }

  function handleAnonymous() {
    selectUser({ id: null, name: 'Anonyme', email: '', isAnonymous: true });
    navigate('/products');
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = `${c.firstname ?? ''} ${c.lastname ?? ''}`.toLowerCase();
    return name.includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">MyStore</h1>
          <p className="text-gray-500 mt-2 text-sm">Choisissez votre profil pour continuer</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-lg"
        >
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              Erreur : {error}
            </div>
          )}

          {customers.length > 4 && (
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          )}

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((c, idx) => (
                  <UserCard key={c.id} customer={c} idx={idx} onSelect={handleSelect} />
                ))}

                {filtered.length === 0 && search && (
                  <p className="text-center text-sm text-gray-400 py-8">Aucun client trouvé</p>
                )}

                <motion.button
                  whileHover={{ x: 4 }}
                  onClick={handleAnonymous}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-700 text-sm">Navigation anonyme</p>
                    <p className="text-xs text-gray-400">Parcourir sans se connecter</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
