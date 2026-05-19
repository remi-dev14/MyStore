import { useLocation, Link } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const BREADCRUMBS = {
  '/admin/dashboard': [{ label: 'Dashboard' }],
  '/admin/import':    [{ label: 'Import' }],
  '/admin/orders':    [{ label: 'Commandes' }],
  '/admin/carts':     [{ label: 'Paniers' }],
  '/admin/stock':     [{ label: 'Stock' }],
  '/admin/reset':     [{ label: 'Réinitialiser' }],
};

export default function Navbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const crumbs = BREADCRUMBS[pathname] ?? [];

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <header className="fixed top-0 right-0 left-[var(--sidebar-w,240px)] lg:left-[240px] h-14 bg-white border-b border-slate-100 z-10 flex items-center px-5 gap-4 shadow-sm">
      {/* Mobile menu button */}
      <button
        className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
        onClick={onMenuClick}
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        <Link to="/admin/dashboard" className="text-slate-400 hover:text-slate-600">Admin</Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">{c.label}</span>
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
            <User size={13} className="text-indigo-600" />
          </div>
          <span className="text-xs font-medium text-slate-600 hidden sm:block">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Déconnexion"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
