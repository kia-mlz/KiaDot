'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageProvider';

export interface LandingCopy {
  sloganFa: string;
  sloganEn: string;
  missionFa: string;
  missionEn: string;
}

type ShowcaseKind = 'course' | 'material' | 'event' | 'job';
type DemandKind = 'enrollments' | 'views' | 'signups' | 'applications';

interface ShowcaseDepartment {
  key: string;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  descriptionEn: string;
  path: string;
}

interface ShowcaseItem {
  kind: ShowcaseKind;
  id: string;
  title: string;
  summary: string;
  descriptionEn: string | null;
  href: string;
  createdAt: string;
  demand: number;
  demandKind: DemandKind;
  department: string;
  comingSoon?: boolean;
}

interface ShowcaseResponse {
  departments: ShowcaseDepartment[];
  newest: ShowcaseItem[];
  demand: ShowcaseItem[];
}

const DEPT_CLASS: Record<string, string> = {
  academy: 'dept--academy',
  events: 'dept--events',
  material: 'dept--material',
  work: 'dept--work',
  community: 'dept--community',
  labs: 'dept--labs',
};

const KIND_LABEL: Record<ShowcaseKind, string> = {
  course: 'landing.story.course',
  material: 'landing.story.material',
  event: 'landing.story.event',
  job: 'landing.story.job',
};

const DEMAND_LABEL: Record<DemandKind, string> = {
  enrollments: 'landing.story.enrollments',
  views: 'landing.story.views',
  signups: 'landing.story.signups',
  applications: 'landing.story.applications',
};

const KINDS = new Set<string>(Object.keys(KIND_LABEL));
const DEMAND_KINDS = new Set<string>(Object.keys(DEMAND_LABEL));

function deptClass(key: string): string {
  return DEPT_CLASS[key] ?? '';
}

function internalHref(href: string): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return href;
}

function pickLocale(locale: string, fa: string, en: string): string {
  const primary = (locale === 'fa' ? fa : en).trim();
  const secondary = (locale === 'fa' ? en : fa).trim();
  return primary || secondary;
}

function isDepartment(value: unknown): value is ShowcaseDepartment {
  if (!value || typeof value !== 'object') return false;
  const row = value as ShowcaseDepartment;
  return (
    typeof row.key === 'string' &&
    typeof row.path === 'string' &&
    typeof row.nameFa === 'string' &&
    typeof row.nameEn === 'string' &&
    typeof row.descriptionFa === 'string' &&
    typeof row.descriptionEn === 'string'
  );
}

function isItem(value: unknown): value is ShowcaseItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as ShowcaseItem;
  return (
    typeof row.kind === 'string' &&
    KINDS.has(row.kind) &&
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    typeof row.summary === 'string' &&
    typeof row.href === 'string' &&
    typeof row.createdAt === 'string' &&
    typeof row.demand === 'number' &&
    Number.isFinite(row.demand) &&
    typeof row.demandKind === 'string' &&
    DEMAND_KINDS.has(row.demandKind) &&
    typeof row.department === 'string'
  );
}

function readShowcase(value: unknown): ShowcaseResponse | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as ShowcaseResponse;
  if (!Array.isArray(row.departments) || !Array.isArray(row.newest) || !Array.isArray(row.demand)) {
    return null;
  }
  return {
    departments: row.departments.filter(isDepartment),
    newest: row.newest.filter(isItem),
    demand: row.demand.filter(isItem),
  };
}

export function LandingStory({ copy }: { copy: LandingCopy | null }) {
  const { t, locale, format } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<ShowcaseResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/showcase')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('showcase'))))
      .then((payload: unknown) => {
        if (cancelled) return;
        const parsed = readShowcase(payload);
        if (!parsed) {
          setStatus('error');
          return;
        }
        setData(parsed);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slogan = pickLocale(locale, copy?.sloganFa ?? '', copy?.sloganEn ?? '') || t('landing.slogan');
  const mission = pickLocale(locale, copy?.missionFa ?? '', copy?.missionEn ?? '') || t('landing.mission');

  function itemSummary(item: ShowcaseItem): string {
    if (locale === 'en' && item.descriptionEn?.trim()) return item.descriptionEn.trim();
    return item.summary;
  }

  function renderItems(items: ShowcaseItem[], emptyKey: string) {
    if (items.length === 0) {
      return (
        <p className="landing-story-empty" role="status">
          {t(emptyKey)}
        </p>
      );
    }
    return (
      <ul className="landing-story-list">
        {items.map((item) => {
          const href = internalHref(item.href);
          const summary = itemSummary(item);
          const body = (
            <>
              <p className="landing-story-kicker">
                <span className={`landing-story-kind ${deptClass(item.department)}`.trim()}>
                  {t(KIND_LABEL[item.kind])}
                </span>
                {item.comingSoon ? <span className="landing-story-soon">{t('common.comingSoon')}</span> : null}
              </p>
              <h3>{item.title}</h3>
              {summary ? <p className="landing-story-summary">{summary}</p> : null}
              <p className="landing-story-meta">
                {Number.isFinite(Date.parse(item.createdAt)) ? (
                  <time dateTime={item.createdAt}>{format.date(item.createdAt)}</time>
                ) : null}
                <span className="landing-story-count">
                  {format.number(item.demand)} {t(DEMAND_LABEL[item.demandKind])}
                </span>
              </p>
            </>
          );
          return (
            <li key={`${item.kind}:${item.id}`}>
              {href ? (
                <Link href={href} className="landing-story-item">
                  {body}
                </Link>
              ) : (
                <article className="landing-story-item">{body}</article>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="landing-story container">
      <section className="landing-story-section" aria-labelledby="landing-story-about">
        <h2 id="landing-story-about">{t('landing.story.aboutTitle')}</h2>
        <p className="landing-story-slogan">{slogan}</p>
        <p className="landing-story-mission">{mission}</p>
        <p className="landing-story-body">{t('landing.story.aboutBody')}</p>
      </section>

      {status === 'loading' ? (
        <p className="landing-story-empty" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {status === 'error' ? (
        <p className="landing-story-empty" role="status">
          {t('landing.story.unavailable')}
        </p>
      ) : null}

      {status === 'ready' && data ? (
        <>
          <section className="landing-story-section" aria-labelledby="landing-story-departments">
            <h2 id="landing-story-departments">{t('landing.story.departmentsTitle')}</h2>
            {data.departments.length === 0 ? (
              <p className="landing-story-empty" role="status">
                {t('landing.story.departmentsEmpty')}
              </p>
            ) : (
              <ul className="landing-story-depts">
                {data.departments.map((department) => {
                  const href = internalHref(department.path);
                  const name = pickLocale(locale, department.nameFa, department.nameEn);
                  const description = pickLocale(locale, department.descriptionFa, department.descriptionEn);
                  const className = `landing-story-dept ${deptClass(department.key)}`.trim();
                  const body = (
                    <>
                      <span className="landing-story-dept-name">{name}</span>
                      {description ? <span className="landing-story-dept-desc">{description}</span> : null}
                    </>
                  );
                  return (
                    <li key={department.key}>
                      {href ? (
                        <Link href={href} className={className}>
                          {body}
                        </Link>
                      ) : (
                        <article className={className}>{body}</article>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="landing-story-section" aria-labelledby="landing-story-newest">
            <h2 id="landing-story-newest">{t('landing.story.newestTitle')}</h2>
            {renderItems(data.newest, 'landing.story.newestEmpty')}
          </section>

          <section className="landing-story-section" aria-labelledby="landing-story-demand">
            <h2 id="landing-story-demand">{t('landing.story.demandTitle')}</h2>
            {renderItems(data.demand, 'landing.story.demandEmpty')}
          </section>
        </>
      ) : null}
    </div>
  );
}
