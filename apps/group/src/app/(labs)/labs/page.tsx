'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { DepartmentBlurb } from '@/components/departments/DepartmentBlurb';
import { eco } from '@/lib/eco';

type Project = { id: string; title: string; problem: string; status: string; visibility: string };
type Idea = { id: string; title: string; score: number; status: string };

export default function LabsPage() {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [method, setMethod] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Project[]>('/labs/projects').then(setProjects).catch((err: Error) => setMessage(err.message));
    eco<Idea[]>('/labs/ideas').then(setIdeas).catch(() => undefined);
  };

  useEffect(load, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      await eco('/labs/projects', { method: 'POST', body: JSON.stringify({ title, problem, method }) });
      setTitle('');
      setProblem('');
      setMethod('');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="page-content labs-page">
      <div className="container hub">
        <header className="page-head">
          <h1>آزمایشگاه کیادات</h1>
          <DepartmentBlurb department="labs" fallback="پروژه‌های پژوهشی، ایده و وضعیت انتشار." />
        </header>
        {message ? <p role="alert">{message}</p> : null}
        <div className="bento">
          {projects.map((project) => (
            <article key={project.id} className="tile tile--half dept--labs">
              <b>{project.title}</b>
              <span>{project.problem}</span>
              <span className="t-status">{project.visibility === 'public' ? 'عمومی' : 'خصوصی'} · {project.status}</span>
            </article>
          ))}
          {projects.length === 0 ? <p>هنوز پروژهٔ عمومی‌ای نیست.</p> : null}
        </div>
        <h2>ایده‌ها</h2>
        <ul>
          {ideas.map((idea) => (
            <li key={idea.id}>{idea.title} — امتیاز {idea.score} — {idea.status}</li>
          ))}
        </ul>
        {isAuthenticated ? (
          <form className="stack" onSubmit={create}>
            <h2>پروژه جدید</h2>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان" required />
            <textarea className="input" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="مسئله" required />
            <textarea className="input" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="روش" required />
            <button className="btn btn--primary" type="submit">ثبت پروژه</button>
          </form>
        ) : (
          <Link href="/education?next=/labs" className="btn btn--primary">برای ثبت پروژه وارد شوید</Link>
        )}
        <Link href="/labs/panel">پنل آزمایشگاه</Link>
      </div>
    </div>
  );
}
