'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { DepartmentBlurb } from '@/components/departments/DepartmentBlurb';
import { eco } from '@/lib/eco';

type Resource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  access: string;
  priceIrr: number;
  kind: string;
};

export default function MaterialCatalogPage() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Resource[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Resource[]>('/material/resources').then(setItems).catch((err: Error) => setMessage(err.message));
  };
  useEffect(load, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await eco('/material/resources', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category: 'notes',
          kind: 'pdf',
          access: 'free',
          published: true,
          tags: ['یادداشت'],
        }),
      });
      setTitle('');
      setDescription('');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="page-content">
      <div className="container hub">
        <header className="page-head">
          <h1>فروشگاه متریال</h1>
          <DepartmentBlurb department="material" fallback="فایل‌های خصوصی فقط با توکن زمان‌دار دانلود می‌شوند." />
          <Link href="/material">استودیو</Link>
        </header>
        {message ? <p role="alert">{message}</p> : null}
        <div className="bento">
          {items.map((item) => (
            <article key={item.id} className="tile tile--half dept--material">
              <b>{item.title}</b>
              <span>{item.description}</span>
              <span className="t-status">
                {item.access === 'free' ? 'رایگان' : `${Math.round(item.priceIrr / 10).toLocaleString('fa-IR')} تومان`} · {item.kind}
              </span>
            </article>
          ))}
        </div>
        {isAuthenticated ? (
          <form onSubmit={create} className="stack">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان منبع" required />
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح" required />
            <button className="btn btn--primary" type="submit">انتشار منبع رایگان</button>
          </form>
        ) : (
          <Link href="/education?next=/material/catalog">ورود برای انتشار</Link>
        )}
      </div>
    </div>
  );
}
