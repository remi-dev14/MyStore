import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { Store, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login, DEFAULT_LOGIN, DEFAULT_PWD } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: DEFAULT_LOGIN, password: DEFAULT_PWD });
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const ok = login(form.login, form.password);
    if (ok) navigate('/admin/dashboard');
    else setError('Identifiants incorrects');
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MyStore Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Connexion au backoffice</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Identifiant</label>
              <input
                type="text"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                autoComplete="username"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center bg-red-50 rounded-lg py-2 px-3">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <LogIn size={16} /> Se connecter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
