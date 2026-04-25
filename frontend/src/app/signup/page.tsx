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

export default function SignupPage() {
  const { signup } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('errors.password_too_short'));
      return;
    }
    if (password !== confirm) {
      setError(t('errors.password_mismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signup(email, password);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(t(`errors.${err.code}`, err.message));
      else setError(t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-5 bg-stone-50">
      <Card className="p-8 w-full max-w-[420px]" hover={false}>
        <div className="text-center mb-6">
          <div className="inline-flex"><Logo size={32} href={null} /></div>
          <h1 className="text-[22px] font-bold tracking-tight mt-4">Start your shop</h1>
          <p className="text-stone-500 text-sm mt-1">It&rsquo;s free — takes about 2 minutes</p>
        </div>
        <form onSubmit={submit} className="grid gap-3 mb-4">
          <Input name="email" type="email" label={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input name="password" type="password" label={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input name="confirm" type="password" label={t('confirm_password')} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? t('signing_up') : 'Create account'}
          </Button>
        </form>
        <div className="text-center text-sm text-stone-500">
          {t('have_account')}{' '}
          <Link href="/login" className="text-teal-600 font-medium hover:text-teal-700">
            {t('login')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
