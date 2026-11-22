import { createHash } from 'crypto';

export interface LessonHashInput {
  title: string;
  content: string;
  contentEn?: string | null;
}

export function lessonContentHash(input: LessonHashInput): string {
  const body = [input.title, input.content, input.contentEn ?? ''].join('\n---\n');
  return createHash('sha256').update(body).digest('hex');
}

export function isContentStale(publishedHash: string, currentHash: string): boolean {
  return publishedHash !== currentHash;
}

export function publishLessonMismatch(projectLessonId: string, requestedLessonId: string): boolean {
  return projectLessonId !== requestedLessonId;
}

export function renderAllowed(project: { autoRender: boolean; approvedAt: Date | string | null }): boolean {
  return project.autoRender || project.approvedAt != null;
}

export function nextCancelState(status: string): { status: string; cancelRequested: boolean } {
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return { status, cancelRequested: status === 'CANCELLED' };
  }
  if (status === 'QUEUED') {
    return { status: 'CANCELLED', cancelRequested: true };
  }
  return { status, cancelRequested: true };
}

export function canStartRender(input: {
  role: string;
  coursesEdit: boolean;
  coursesManage: boolean;
}): boolean {
  if (input.role === 'LEARNER') return false;
  if (input.role === 'SUPER_ADMIN') return true;
  return input.coursesEdit || input.coursesManage;
}

export const MOTION_LIMITS = {
  narration: 4000,
  onScreen: 600,
  code: 12000,
  title: 200,
  scenes: 40,
  audioBytes: 20 * 1024 * 1024,
  voiceId: 80,
} as const;

export function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return 6;
  return Math.max(3, Math.min(40, Math.round(value)));
}

export function parseAspect(aspect: string): { width: number; height: number } | null {
  if (aspect === '1920x1080') return { width: 1920, height: 1080 };
  if (aspect === '1280x720') return { width: 1280, height: 720 };
  return null;
}

export function parseFps(fps: number): 24 | 30 | null {
  if (fps === 24 || fps === 30) return fps;
  return null;
}
