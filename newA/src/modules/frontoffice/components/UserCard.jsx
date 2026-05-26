import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-sky-100 text-sky-700',
];

function getInitials(name) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UserCard({ customer, idx, onSelect }) {
  const name = `${customer.firstname ?? ''} ${customer.lastname ?? ''}`.trim() || `Client #${customer.id}`;
  const colorClass = COLORS[idx % COLORS.length];

  return (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={() => onSelect(customer)}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-indigo-50/50 transition-colors text-left group"
    >
      <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{name}</p>
        <p className="text-xs text-gray-400 truncate">{customer.email}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
    </motion.button>
  );
}
