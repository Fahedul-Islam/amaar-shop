'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { ApiRequestError } from '@/lib/api';
import { useI18n } from '@/hooks/useI18n';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(t(`errors.${err.code}`, err.message));
      } else {
        setError(t('errors.unknown'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-5 bg-stone-50">
      <Card className="p-8 w-full max-w-[420px]" hover={false}>
        <div className="text-center mb-6">
          <div className="inline-flex"><Logo size={32} href={null} /></div>
          <h1 className="text-[22px] font-bold tracking-tight mt-4">Welcome back</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in to manage your shop</p>
        </div>

        <form onSubmit={submit} className="grid gap-3 mb-4">
          <Input
            name="email"
            type="email"
            label={t('email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Input
            name="password"
            type="password"
            label={t('password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? t('logging_in') : t('login')}
          </Button>
        </form>

        <div className="text-center text-sm text-stone-500">
          {t('no_account')}{' '}
          <Link href="/signup" className="text-teal-600 font-medium hover:text-teal-700">
            Start your shop
          </Link>
        </div>
      </Card>
    </div>
  );
}
