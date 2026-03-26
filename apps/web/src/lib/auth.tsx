import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api.js';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'rep';
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read token from URL fragment (#token=...) — fragments are never sent to
    // servers or included in access logs / Referer headers.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const stored = localStorage.getItem('token');
    if (stored) {
      api<User>('/auth/me')
        .then(setUser)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
