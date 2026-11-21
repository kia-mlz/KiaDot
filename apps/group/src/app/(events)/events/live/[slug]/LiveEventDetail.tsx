'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { eco } from '@/lib/eco';

type Detail = {
  title: string;
  rules: string;
  venue: string;
  speakers: { id: string; name: string }[];
  agenda: { id: string; title: string }[];
  conference: { configured: boolean; joinUrl: string | null; message: string | null };
};

export default function LiveEventDetail() {
  const params = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.slug) return;
    eco<Detail>(`/events/live/${params.slug}`).then(setEvent).catch((err: Error) => setError(err.message));
  }, [params.slug]);

  if (error) return <p role="alert">{error}</p>;
  if (!event) return <p>در حال بارگذاری…</p>;
  return (
    <div className="page-content">
      <div className="container hub">
        <h1>{event.title}</h1>
        <p>{event.venue}</p>
        <p>{event.rules}</p>
        <h2>جلسه آنلاین</h2>
        {event.conference.configured && event.conference.joinUrl ? (
          <a href={event.conference.joinUrl}>ورود به جلسه</a>
        ) : (
          <p>{event.conference.message}</p>
        )}
        <h2>سخنران‌ها</h2>
        <ul>{event.speakers.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
        <h2>برنامه</h2>
        <ul>{event.agenda.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
      </div>
    </div>
  );
}
