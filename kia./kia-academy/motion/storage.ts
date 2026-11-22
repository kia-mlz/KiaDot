import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveUnderRoot } from '@kia./platform';

export function motionRoot(): string {
  return join(process.cwd(), 'uploads', 'motion-private');
}

export function ensureProjectDir(projectId: string): string {
  const dir = resolveUnderRoot(motionRoot(), projectId);
  if (!existsSync(motionRoot())) mkdirSync(motionRoot(), { recursive: true });
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function projectFile(projectId: string, filename: string): string {
  return resolveUnderRoot(motionRoot(), projectId, filename);
}

export function writeProjectFile(projectId: string, filename: string, data: Buffer | string): string {
  const dir = ensureProjectDir(projectId);
  const absolute = resolveUnderRoot(dir, filename);
  writeFileSync(absolute, data);
  return absolute;
}

export function removeProjectFile(projectId: string, filename: string): void {
  const absolute = projectFile(projectId, filename);
  if (existsSync(absolute)) unlinkSync(absolute);
}

export function removeProjectDir(projectId: string): void {
  const dir = resolveUnderRoot(motionRoot(), projectId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/** Drop intermediate frames. The finished MP4 is kept. */
export function cleanupWorkFiles(projectId: string, keep: string[]): void {
  const dir = ensureProjectDir(projectId);
  const keepSet = new Set(keep);
  for (const name of readdirSync(dir)) {
    if (keepSet.has(name)) continue;
    if (name.endsWith('.svg') || name.startsWith('seg-') || name === 'silent.mp4' || name === 'list.txt') {
      unlinkSync(join(dir, name));
    }
  }
}

export function fileSize(absolute: string): number {
  return statSync(absolute).size;
}
