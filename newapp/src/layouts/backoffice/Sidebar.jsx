import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, Upload, Users, ShoppingCart,
  Archive, RotateCcw, ChevronRight, Store, BarChart2,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/import',    icon: Upload,           label: 'Import' },
  { to: '/admin/orders',    icon: ShoppingCart,     label: 'Commandes' },
  { to: '/admin/carts',     icon: Archive,          label: 'Paniers' },
  { to: '/admin/stock',     icon: Package,          label: 'Stock' },
  { to: '/admin/stats',     icon: BarChart2,         label: 'Statistiques' },
  { to: '/admin/reset',     icon: RotateCcw,        label: 'Réinitialiser', danger: true },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={clsx(
        'fixed top-0 left-0 h-full z-30 flex flex-col',
        'bg-slate-900 text-white transition-transform duration-300',
        'w-[var(--sidebar-w,240px)]',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="bg-indigo-600 rounded-lg p-1.5">
            <Store size={18} />
          </div>
          <span className="font-bold text-base tracking-tight">MyStore Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest px-2 mb-2">Navigation</p>
          {NAV.map(({ to, icon: Icon, label, danger }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : danger
                    ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800',
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
          v1.0 · PrestaShop 8
        </div>
      </aside>
    </>
  );
}
