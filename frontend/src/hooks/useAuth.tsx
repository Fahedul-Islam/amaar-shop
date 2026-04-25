'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setAccessToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse { access_token: string; user: User }
interface TokenResponse { access_token: string }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function tryRefresh() {
      try {
        const data = await apiFetch<TokenResponse>('/api/auth/refresh', { method: 'POST' });
        setAccessToken(data.access_token);
        const me = await apiFetch<User>('/api/auth/me');
        setUser(me);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    tryRefresh();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.access_token);
      setUser(data.user);
      router.push('/dashboard');
    },
    [router],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.access_token);
      setUser(data.user);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // clear local state even if server call fails
    }
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
