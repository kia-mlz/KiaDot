import type { NextFunction, Request, Response } from 'express';
import { posix } from 'path';

const PRIVATE_UPLOAD_MESSAGES: Readonly<Record<string, string>> = {
  lessons: 'Use authenticated media URLs for lesson videos',
  tickets: 'Use authenticated ticket attachment URLs',
  material: 'Use an authenticated download token for material files',
  'motion-private': 'Use the authenticated motion media URL',
};

/**
 * Message for a URL under `/api/uploads` that must not be served as a static file.
 * Decoding and `..` are resolved first, so a sibling prefix cannot reach a private directory.
 * Returns null when the static handler may continue.
 */
export function privateUploadMessage(rawUrl: string): string | null {
  const pathname = (rawUrl.split('?')[0] ?? '').replace(/\\/g, '/');
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return 'Invalid upload path';
  }
  const normalized = posix.normalize(decoded);
  const prefix = '/api/uploads/';
  if (!normalized.startsWith(prefix)) return null;
  const directory = normalized.slice(prefix.length).split('/')[0] ?? '';
  if (!directory) return null;
  return PRIVATE_UPLOAD_MESSAGES[directory] ?? null;
}

/**
 * This middleware is mounted at `/api/uploads`. Express may leave `originalUrl` as the
 * full path, or expose only the suffix on `url`. Either form must stay inside that tree.
 */
function uploadsUrl(rawUrl: string): string {
  const pathOnly = (rawUrl.split('?')[0] ?? '').replace(/\\/g, '/');
  if (pathOnly.startsWith('/api/uploads')) return rawUrl;
  const suffix = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : '';
  return `/api/uploads${suffix}${query}`;
}

/** Runs before the uploads static handler. Public files (avatars) call next(). */
export function blockPrivateUploads(req: Request, res: Response, next: NextFunction): void {
  const message = privateUploadMessage(uploadsUrl(req.originalUrl || req.url || ''));
  if (!message) {
    next();
    return;
  }
  res.status(401).json({ message });
}
