import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch (_) {
        localStorage.removeItem('token');
        if (!cancelled) { setToken(null); setUser(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
