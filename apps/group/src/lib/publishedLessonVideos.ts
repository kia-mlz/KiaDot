import type { PublishedMotionVideo } from '@/lib/motionTypes';

/**
 * Published lesson films shipped with the site.
 * The manifest lists only MP4s under /lesson-videos/. Private render frames stay out.
 */

export type PublishedLessonManifest = Record<string, string>;

export function siteBasePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
}

/** Same-origin URL for a public lesson film, including the GitHub Pages base path. */
export function lessonVideoSrc(path: string): string {
  const base = siteBasePath();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (base && (normalized === base || normalized.startsWith(`${base}/`))) return normalized;
  return `${base}${normalized}`;
}

export function publishedVideoFromManifest(
  manifest: PublishedLessonManifest,
  courseSlug: string,
  lessonSlug: string,
): string | null {
  const value = manifest[`${courseSlug}/${lessonSlug}`];
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/lesson-videos/') || !value.endsWith('.mp4')) return null;
  if (value.includes('..') || value.includes('\\') || value.includes('?') || value.includes('#')) return null;
  return lessonVideoSrc(value);
}

/** A committed film, with no storyboard, so the lesson can play without the API. */
export function staticPublishedVideo(lessonId: string, videoUrl: string): PublishedMotionVideo {
  return {
    projectId: 'published-file',
    lessonId,
    position: 'BEFORE_BODY',
    videoUrl,
    stale: false,
    videoVersion: 1,
    contentVersion: 1,
    minWatchPercent: null,
    narrationAudioAttached: false,
    narrationAudioStatus: 'unconfigured',
    scenes: [],
    subtitles: [],
    progress: null,
  };
}

let manifestPromise: Promise<PublishedLessonManifest> | null = null;

export function loadPublishedLessonVideos(): Promise<PublishedLessonManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${siteBasePath()}/lesson-videos/index.json`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((body) => (body && typeof body === 'object' ? (body as PublishedLessonManifest) : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}
