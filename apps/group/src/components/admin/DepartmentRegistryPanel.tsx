'use client';

import { FormEvent, useEffect, useState } from 'react';
import { eco } from '@/lib/eco';

type Row = {
  key: string;
  enabled: boolean;
  nameFa: string;
  descriptionFa: string;
  path: string;
  brandToken: string;
};

type Content = { sloganFa: string; missionFa: string; brandNameFa: string };

export function DepartmentRegistryPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [content, setContent] = useState<Content | null>(null);
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Row[]>('/departments').then(setRows).catch((err: Error) => setMessage(err.message));
    eco<Content>('/content').then(setContent).catch(() => undefined);
  };
  useEffect(load, []);

  const toggle = async (row: Row) => {
    try {
      await eco(`/departments/${row.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  const saveCopy = async (event: FormEvent) => {
    event.preventDefault();
    if (!content) return;
    try {
      await eco('/content', { method: 'PATCH', body: JSON.stringify(content) });
      setMessage('متن عمومی ذخیره شد.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <section className="am-hub__head">
      <h2>رجیستری دپارتمان‌ها</h2>
      {message ? <p role="status">{message}</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            {row.nameFa} ({row.path}) · {row.brandToken} · {row.enabled ? 'فعال' : 'خاموش'}{' '}
            <button type="button" className="btn btn--ghost" onClick={() => toggle(row)}>
              {row.enabled ? 'غیرفعال کن' : 'فعال کن'}
            </button>
          </li>
        ))}
      </ul>
      {content ? (
        <form onSubmit={saveCopy} className="stack">
          <input className="input" value={content.brandNameFa} onChange={(e) => setContent({ ...content, brandNameFa: e.target.value })} />
          <input className="input" value={content.sloganFa} onChange={(e) => setContent({ ...content, sloganFa: e.target.value })} />
          <textarea className="input" value={content.missionFa} onChange={(e) => setContent({ ...content, missionFa: e.target.value })} />
          <button className="btn btn--primary" type="submit">ذخیره شعار و مأموریت</button>
        </form>
      ) : null}
    </section>
  );
}
