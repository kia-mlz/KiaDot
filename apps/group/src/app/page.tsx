'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { LandingStory } from '@/components/landing/LandingStory';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { HOME_PATH } from '@/lib/postLoginPath';
import { useAuth } from '@/context/AuthProvider';
import { useLanguage } from '@/context/LanguageProvider';
import { useTheme } from '@/context/ThemeProvider';

/**
 * Guest landing. The first viewport is the brand hero. Scrolling reveals the
 * platform description, published departments, and live catalog rows from
 * /api/showcase. A signed-in user with a completed profile goes to HOME_PATH.
 */
export default function HomePage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { toggleTheme } = useTheme();
  const { user, learnerState, loading, isAuthenticated } = useAuth();
  const registered = Boolean(user?.profileComplete || learnerState?.profileComplete);
  const [copy, setCopy] = useState<{
    brandNameFa: string;
    brandNameEn: string;
    sloganFa: string;
    sloganEn: string;
    missionFa: string;
    missionEn: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/content')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCopy(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !isAuthenticated || !registered) return;
    router.replace(HOME_PATH);
  }, [loading, isAuthenticated, registered, router]);

  if (loading || (isAuthenticated && registered)) {
    return <div className="page-content landing auth-loading" aria-busy="true" />;
  }

  return (
    <div className="page-content landing landing-min">
      {/* language + color mode — always reachable on the first page */}
      <div className="landing-controls">
        <LanguageSelector />
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={t('nav.toggleColorMode')}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            ◐
          </span>
          <span className="theme-toggle-label">{t('nav.mode')}</span>
        </button>
      </div>

      <main className="landing-intro container">
        <header className="landing-hero">
          {/* Brand wordmark is the sole hero heading; the five-pillar tagline
              and short pitch sit under it as body copy (landing-title /
              landing-body), not as extra headings. */}
          <h1 className="landing-brand">
            <BrandMark className="landing-brand-mark" title="" />
            {(locale === 'fa' ? copy?.brandNameFa : copy?.brandNameEn) || t('common.brand')}
          </h1>
          <p className="landing-title">{(locale === 'fa' ? copy?.sloganFa : copy?.sloganEn) || t('landing.slogan')}</p>
          <p className="landing-body">{(locale === 'fa' ? copy?.missionFa : copy?.missionEn) || t('landing.mission')}</p>

          <div className="hero-actions landing-min-actions">
            <Link
              href={isAuthenticated ? HOME_PATH : `/education?next=${encodeURIComponent(HOME_PATH)}`}
              className="btn btn--accent btn--lg hero-cta"
            >
              {t('landing.ctaStart')}
            </Link>
          </div>

          <Link href="/login" className="landing-min-email">
            {t('landing.ctaEmail')}
          </Link>
        </header>
      </main>
      <LandingStory copy={copy} />
    </div>
  );
}
