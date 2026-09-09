'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function PasswordResetForm({ admin = false }: { admin?: boolean }) {
 const [email,setEmail]=useState('');
 const [code,setCode]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [sent,setSent]=useState(false);
 const [done,setDone]=useState(false);
 const [busy,setBusy]=useState(false);
 const [cooldown,setCooldown]=useState(0);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer)},[cooldown]);
 async function request() {
  setBusy(true);setError('');setMessage('');
  try {const data=await apiFetch<{message:string}>('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:email.trim()})});setMessage(data.message);setSent(true);setCooldown(60)}
  catch(e){setError(e instanceof ApiRequestError?e.message:'Unable to request a code. Try again.')}
  finally{setBusy(false)}
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!sent){await request();return}
  if(password!==confirm){setError('Passwords do not match.');return}
  if(new TextEncoder().encode(password).length>72){setError('Password must be at most 72 bytes.');return}
  setBusy(true);setError('');setMessage('');
  try{const data=await apiFetch<{message:string}>('/api/auth/reset-password',{method:'POST',body:JSON.stringify({email:email.trim(),code,password})});setMessage(data.message);setDone(true);setPassword('');setConfirm('')}
  catch(e){setError(e instanceof ApiRequestError?e.message:'Unable to reset password. Try again.')}
  finally{setBusy(false)}
 }
 return <div className="min-h-screen grid place-items-center p-5 bg-stone-50"><Card className="p-8 w-full max-w-[420px]" hover={false}>
 <h1 className="text-[22px] font-bold mb-2">Reset {admin?'admin':'seller'} password</h1>
 <p className="text-sm text-stone-500 mb-5">We’ll email you a six-digit code, valid for 10 minutes.</p>
 {message&&<p role="status" className="text-sm text-teal-700 mb-4">{message}</p>}
 {error&&<p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
 {!done&&<form onSubmit={submit} className="grid gap-3">
 <Input label="Account email" type="email" autoComplete="email" required value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)}/>
 {sent&&<><Input label="Email code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/>
 <Input label="New password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/>
 <Input label="Confirm new password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></>}
 <Button type="submit" disabled={busy}>{busy?'Please wait…':sent?'Reset password':'Send code'}</Button>
 {sent&&<><Button type="button" disabled={busy||cooldown>0} onClick={request}>{cooldown>0?`Resend in ${cooldown}s`:'Resend code'}</Button><button type="button" disabled={busy} className="text-sm text-stone-600" onClick={()=>{setSent(false);setCode('');setMessage('');setError('')}}>Use another email</button></>}
 </form>}
 <Link className="block text-center text-sm text-teal-600 mt-5" href={admin?'/admin/login':'/login'}>Back to sign in</Link>
 </Card></div>
}
