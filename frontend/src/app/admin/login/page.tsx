'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { apiFetch, ApiRequestError, setAccessToken } from '@/lib/api';

interface User {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}
interface AuthResponse { access_token: string; user: User }

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!data.user.is_admin) {
        setAccessToken(null);
        setError('This account does not have admin access.');
        setLoading(false);
        return;
      }
      setAccessToken(data.access_token);
      // Force a full reload so the AuthProvider re-bootstraps with the new
      // access token and the AdminShell sees user.is_admin = true.
      window.location.href = '/admin';
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.code === 'unauthorized' ? 'Wrong email or password.' : err.message);
      } else {
        setError('Something went wrong. Try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-5 bg-stone-50">
      <Card className="p-8 w-full max-w-[420px]" hover={false}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <Logo size={32} href={null} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 border border-stone-200 rounded px-1.5 py-0.5 bg-white">
              Admin
            </span>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mt-4">Platform admin</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in to manage AmaarShop</p>
        </div>

        <form onSubmit={submit} className="grid gap-3 mb-4">
          <Input
            name="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@amaarshop.com"
            required
          />
          <Input
            name="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="text-center text-xs text-stone-500">
          Admin access only. Shop owners use the{' '}
          <a href="/login" className="text-teal-600 font-medium hover:text-teal-700">
            seller login
          </a>.
        </div>
      </Card>
    </div>
  );
}
