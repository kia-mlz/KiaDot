'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { eco } from '@/lib/eco';

type Activity = { id: string; title: string; kind: string; timeLimitSec: number };
type Opened = { id: string; title: string; kind: string; token: string; payload: { questions?: { prompt: string; choices?: string[] }[]; cards?: { front: string }[]; left?: string[]; right?: string[] } };

const KINDS = ['quiz', 'multiple_choice', 'matching', 'true_false', 'flashcards', 'fill_blank'] as const;

export default function PracticePage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    eco<Activity[]>('/academy/activities').then(setActivities).catch(() => undefined);
  }, []);

  const open = async (id: string) => {
    const session = await eco<Opened>(`/academy/activities/${id}/open`, { method: 'POST' });
    setOpened(session);
    setResult('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!opened) return;
    const kind = opened.kind;
    let submission: unknown = { answers: [answer] };
    if (kind === 'quiz' || kind === 'multiple_choice' || kind === 'matching') {
      submission = { answers: answer.split(',').map((part) => (kind === 'matching' ? part.trim() : Number(part.trim()))) };
    } else if (kind === 'true_false') {
      submission = { answers: answer.split(',').map((part) => part.trim() === 'true') };
    } else if (kind === 'flashcards') {
      submission = { known: answer.split(',').map((part) => Number(part.trim())).filter((n) => !Number.isNaN(n)) };
    }
    const grade = await eco<{ score: number; maxScore: number; timedOut: boolean }>(`/academy/activities/${opened.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ token: opened.token, submission }),
    });
    setResult(`نمره ${grade.score} از ${grade.maxScore}${grade.timedOut ? ' (زمان تمام شد)' : ''}`);
  };

  const createSample = async () => {
    await eco('/academy/activities', {
      method: 'POST',
      body: JSON.stringify({
        title: 'نمونه چندگزینه‌ای',
        kind: 'multiple_choice',
        timeLimitSec: 120,
        payload: { questions: [{ prompt: '۲+۲؟', choices: ['۳', '۴'], answerIndex: 1 }] },
      }),
    });
    setActivities(await eco<Activity[]>('/academy/activities'));
  };

  return (
    <div className="page-content">
      <div className="container hub">
        <h1>فعالیت‌های آموزشی</h1>
        <p>آزمون، چندگزینه‌ای، تطبیق، درست/نادرست، فلش‌کارت و جای‌خالی. پاسخ درست فقط روی سرور است.</p>
        {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ? (
          <button type="button" className="btn btn--ghost" onClick={createSample}>ساخت نمونه</button>
        ) : null}
        <ul>
          {activities.map((activity) => (
            <li key={activity.id}>
              {activity.title} ({activity.kind}){' '}
              <button type="button" className="btn btn--primary" onClick={() => open(activity.id)}>شروع</button>
            </li>
          ))}
        </ul>
        {opened ? (
          <form onSubmit={submit} className="stack">
            <h2>{opened.title}</h2>
            <pre>{JSON.stringify(opened.payload, null, 2)}</pre>
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="پاسخ‌ها با ویرگول. چندگزینه‌ای: شماره گزینه از صفر" />
            <button className="btn btn--primary" type="submit">ثبت نمره</button>
            {result ? <p>{result}</p> : null}
          </form>
        ) : null}
        <p>گونه‌های پیاده‌سازی‌شده: {KINDS.join('، ')}</p>
      </div>
    </div>
  );
}
