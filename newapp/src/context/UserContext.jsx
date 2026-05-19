import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('fo_user') || 'null'); } catch { return null; }
  });

  function selectUser(u) {
    sessionStorage.setItem('fo_user', JSON.stringify(u));
    setUser(u);
  }

  function clearUser() {
    sessionStorage.removeItem('fo_user');
    setUser(null);
  }

  return (
    <UserContext.Provider value={{ user, selectUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
