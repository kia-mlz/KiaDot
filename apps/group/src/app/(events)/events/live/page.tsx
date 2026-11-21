'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { DepartmentBlurb } from '@/components/departments/DepartmentBlurb';
import { eco } from '@/lib/eco';

type Live = {
  id: string;
  slug: string;
  title: string;
  venue: string;
  isFree: boolean;
  priceIrr: number;
  startsAt: string;
  _count?: { signups: number };
};

export default function LiveEventsPage() {
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<Live[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Live[]>('/events/live').then(setEvents).catch((err: Error) => setMessage(err.message));
  };
  useEffect(load, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await eco('/events/live', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category: 'meetup',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          venue: 'آنلاین',
          published: true,
          isFree: true,
          capacity: 50,
        }),
      });
      setTitle('');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  const register = async (id: string) => {
    try {
      const result = await eco<{ paymentRequired?: boolean; code?: string }>(`/events/live/${id}/register`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage(result.paymentRequired ? 'این رویداد پرداخت می‌خواهد. صورتحساب ساخته شد.' : 'ثبت‌نام انجام شد.');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="page-content">
      <div className="container hub">
        <header className="page-head">
          <h1>رویدادهای زنده</h1>
          <DepartmentBlurb department="events" fallback="ثبت‌نام، ظرفیت و لینک حضور. اگر سرویس جلسه تنظیم نشده باشد، وضعیت «پیکربندی نشده» نشان داده می‌شود." />
        </header>
        {message ? <p role="status">{message}</p> : null}
        <div className="bento">
          {events.map((item) => (
            <article key={item.id} className="tile tile--half dept--events">
              <b>{item.title}</b>
              <span>{item.venue} · {item.isFree ? 'رایگان' : `${Math.round(item.priceIrr / 10).toLocaleString('fa-IR')} تومان`}</span>
              <span className="t-status">{new Date(item.startsAt).toLocaleString('fa-IR')}</span>
              {isAuthenticated ? (
                <button type="button" className="btn btn--primary" onClick={() => register(item.id)}>ثبت‌نام</button>
              ) : null}
              <Link href={`/events/live/${item.slug}`}>جزئیات</Link>
            </article>
          ))}
        </div>
        {isAuthenticated ? (
          <form onSubmit={create} className="stack">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان رویداد" required />
            <button className="btn btn--primary" type="submit">انتشار رویداد رایگان</button>
          </form>
        ) : (
          <Link href="/login?next=/events/live">ورود برای ساخت رویداد</Link>
        )}
      </div>
    </div>
  );
}
