'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { eco } from '@/lib/eco';

type Department = { key: string; enabled: boolean; nameFa: string; path: string; descriptionFa: string };
type Note = { id: string; title: string; body: string; readAt: string | null };
type Invoice = { id: string; title: string; status: string; amountIrr: number; provider: string | null };

export function CentralHome() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      eco<Department[]>('/departments'),
      eco<Note[]>('/notifications').catch(() => [] as Note[]),
      eco<Invoice[]>('/billing/invoices').catch(() => [] as Invoice[]),
    ])
      .then(([depts, n, inv]) => {
        if (cancelled) return;
        setDepartments(depts.filter((d) => d.enabled));
        setNotes(n);
        setInvoices(inv);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="hub" aria-label="داشبورد">
      <header className="page-head">
        <h1>سلام{user?.name ? ` ${user.name}` : ''}</h1>
        <p>دپارتمان‌هایی که می‌توانید استفاده کنید، فعالیت اخیر و وضعیت پرداخت.</p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <div className="bento">
        {departments.map((dept) => (
          <Link key={dept.key} href={dept.path} className={`tile tile--half dept--${dept.key}`}>
            <b>{dept.nameFa}</b>
            <span>{dept.descriptionFa}</span>
          </Link>
        ))}
      </div>
      <div className="bento">
        <article className="tile tile--half">
          <b>اعلان‌ها</b>
          {notes.length === 0 ? <span>اعلان جدیدی نیست.</span> : null}
          {notes.slice(0, 5).map((note) => (
            <span key={note.id}>
              {note.title} — {note.body}
            </span>
          ))}
        </article>
        <article className="tile tile--half">
          <b>پرداخت‌ها</b>
          {invoices.length === 0 ? <span>صورتحسابی ثبت نشده.</span> : null}
          {invoices.slice(0, 5).map((invoice) => (
            <span key={invoice.id}>
              {invoice.title}: {invoice.status}
              {invoice.provider === 'dev' ? ' (درگاه توسعه)' : ''} — {Math.round(invoice.amountIrr / 10).toLocaleString('fa-IR')} تومان
            </span>
          ))}
          <Link href="/dashboard/security">امنیت و نشست‌ها</Link>
        </article>
      </div>
    </section>
  );
}
