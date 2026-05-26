import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const DEFAULT_LOGIN = import.meta.env.VITE_BO_LOGIN || 'admin';
const DEFAULT_PWD = import.meta.env.VITE_BO_PWD || 'admin123';

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('bo_auth') === 'true'
  );

  function login(login, password) {
    if (login === DEFAULT_LOGIN && password === DEFAULT_PWD) {
      localStorage.setItem('bo_auth', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem('bo_auth');
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, DEFAULT_LOGIN, DEFAULT_PWD }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
