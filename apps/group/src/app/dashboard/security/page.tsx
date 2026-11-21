'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { eco } from '@/lib/eco';

type Session = { id: string; createdAt: string; expiresAt: string };

export default function SecurityPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    eco<Session[]>('/auth/sessions').then(setSessions).catch(() => undefined);
  }, []);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await eco('/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password }) });
      setMessage('حساب ساخته شد. اگر ایمیل تنظیم نشده باشد، لینک تأیید در لاگ سرور است.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  const revoke = async (id: string) => {
    await eco(`/auth/sessions/${id}/revoke`, { method: 'POST' });
    setSessions(await eco<Session[]>('/auth/sessions'));
  };

  const deactivate = async () => {
    await eco('/auth/deactivate', { method: 'POST' });
    await api.logout();
    router.push('/');
  };

  return (
    <div className="page-content">
      <div className="container hub">
        <h1>امنیت حساب</h1>
        {message ? <p role="status">{message}</p> : null}
        <h2>نشست‌ها</h2>
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              {new Date(session.createdAt).toLocaleString('fa-IR')}{' '}
              <button type="button" className="btn btn--ghost" onClick={() => revoke(session.id)}>لغو</button>
            </li>
          ))}
        </ul>
        <h2>ثبت‌نام با ایمیل</h2>
        <form onSubmit={register} className="stack">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" required />
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام" required />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز" required />
          <button className="btn btn--primary" type="submit">ثبت‌نام</button>
        </form>
        <button type="button" className="btn btn--ghost" onClick={deactivate}>غیرفعال‌سازی حساب</button>
      </div>
    </div>
  );
}
