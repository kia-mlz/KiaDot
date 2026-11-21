'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Briefcase, Rocket } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { DepartmentBlurb } from '@/components/departments/DepartmentBlurb';
import { eco } from '@/lib/eco';

type Job = { id: string; title: string; category: string; description: string };

function WorkBoard() {
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('برنامه‌نویسی');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Job[]>('/work/jobs').then(setJobs).catch((err: Error) => setMessage(err.message));
  };
  useEffect(load, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await eco('/work/jobs', { method: 'POST', body: JSON.stringify({ title, category, description }) });
      setTitle('');
      setDescription('');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <section>
      <h2>فرصت‌های شغلی</h2>
      {message ? <p role="alert">{message}</p> : null}
      <div className="bento">
        {jobs.map((job) => (
          <article key={job.id} className="tile tile--half dept--work">
            <b>{job.title}</b>
            <span>{job.category}</span>
            <span>{job.description}</span>
            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => eco(`/work/jobs/${job.id}/apply`, { method: 'POST', body: JSON.stringify({ cover: 'علاقه‌مندم.' }) }).then(() => setMessage('درخواست ثبت شد.')).catch((err: Error) => setMessage(err.message))}
              >
                ارسال درخواست
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {isAuthenticated ? (
        <form onSubmit={create} className="stack">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان شغل" required />
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="دسته" required />
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح شغل، حداقل ده نویسه" required />
          <button className="btn btn--primary" type="submit">ثبت آگهی</button>
        </form>
      ) : null}
    </section>
  );
}

/**
 * Employer & freelancer hub — one of the three post-login doors.
 * Both cards lead to working destinations: the contact form for employers
 * and the learning path for freelancers.
 */
export default function FreelancePage() {
  const { t } = useLanguage();

  return (
    <div className="page-content freelance-page">
      <div className="container hub">
        <div className="bento">
          <Link href="/contact" className="tile tile--half tile--feature">
            <span className="t-icon t-icon--brand" aria-hidden="true">
              <Briefcase size={22} />
            </span>
            <b>{t('freelance.employer.title')}</b>
            <span>{t('freelance.employer.body')}</span>
            <span className="t-status t-status--brand">{t('freelance.employer.cta')}</span>
          </Link>

          <Link href="/education" className="tile tile--half">
            <span className="t-icon" aria-hidden="true">
              <Rocket size={22} />
            </span>
            <b>{t('freelance.freelancer.title')}</b>
            <span>{t('freelance.freelancer.body')}</span>
            <span className="t-status">{t('freelance.freelancer.cta')}</span>
          </Link>
        </div>

        <div className="hub-actions">
          <Link href="/work/panel" className="btn btn--primary btn--lg">
            {t('panel.departments.work')}
          </Link>
        </div>

        <p className="freelance-note">{t('freelance.note')}</p>
        <DepartmentBlurb department="work" fallback="پروفایل تخصصی، آگهی شغل و پروژه آزاد." />
        <WorkBoard />
      </div>
    </div>
  );
}
