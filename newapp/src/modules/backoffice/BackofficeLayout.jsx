import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './backoffice.css';

export default function BackofficeLayout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <div className="bo-layout">
      <nav className="bo-nav">
        <span className="bo-brand">NewApp — Admin</span>
        <div className="bo-nav-links">
          <Link to="/admin/dashboard">Tableau de bord</Link>
          <Link to="/admin/import">Import</Link>
          <Link to="/admin/orders">Commandes</Link>
          <Link to="/admin/carts">Paniers</Link>
          <Link to="/admin/stock/add">Stock</Link>
          <Link to="/admin/reset">Réinitialiser</Link>
          <button className="bo-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>
      <main className="bo-main">{children}</main>
    </div>
  );
}
