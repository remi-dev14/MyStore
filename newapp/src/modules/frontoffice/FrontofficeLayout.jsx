import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Search, User, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { useCart } from '../../context/CartContext.jsx';
import { useUser } from '../../context/UserContext.jsx';
import CartDrawer from './components/CartDrawer.jsx';

export default function FrontofficeLayout({ children }) {
  const { cartCount, setIsOpen } = useCart();
  const { user, clearUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleLogout() {
    clearUser();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  }

  function isActive(path) {
    return location.pathname === path ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-600';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/products" className="text-2xl font-black text-indigo-600 tracking-tight shrink-0">
            MyStore
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/products" className={`transition-colors ${isActive('/products')}`}>Produits</Link>
            <Link to="/search" className={`transition-colors ${isActive('/search')}`}>Recherche</Link>
            {user && !user.isAnonymous && (
              <Link to="/my-orders" className={`transition-colors ${isActive('/my-orders')}`}>Mes commandes</Link>
            )}
          </nav>

          <div className="flex items-center gap-1">
            <Link to="/search" className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden" title="Recherche">
              <Search className="w-5 h-5 text-gray-600" />
            </Link>

            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Panier"
            >
              <ShoppingBag className="w-5 h-5 text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[90px] truncate">
                    {user.isAnonymous ? 'Anonyme' : user.name.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="text-xs text-gray-400 mb-0.5">Connecté en tant que</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user.isAnonymous ? 'Anonyme' : user.name}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-gray-400" />
                      Changer d'utilisateur
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden ml-1"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-gray-700 hover:text-indigo-600">Produits</Link>
            <Link to="/search" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-gray-700 hover:text-indigo-600">Recherche</Link>
            {user && !user.isAnonymous && (
              <Link to="/my-orders" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-gray-700 hover:text-indigo-600">Mes commandes</Link>
            )}
            {user && (
              <button onClick={handleLogout} className="w-full text-left py-2 text-sm font-medium text-red-500 hover:text-red-600">
                Changer d'utilisateur
              </button>
            )}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">{children}</main>

      <CartDrawer />
    </div>
  );
}
