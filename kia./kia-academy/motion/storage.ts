import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveUnderRoot } from '@kia./platform';
import { detectAudioMime, extensionForMime } from './audio';
import { MOTION_LIMITS } from './policy';

const TEXT_FILE = /^(?:list\.txt|stage-\d+\.html|line-\d+-(?:title-\d+|body-\d+|code-\d+|instructor)\.txt)$/;
const FRAME_FILE = /^frame-\d+-\d{4}\.png$/;
const AUDIO_FILE =
  /^(?:narration|tts)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:mp3|wav|ogg|webm|m4a)$/;
const VIDEO_FILE = /^video-v\d+\.mp4$/;

export function motionRoot(): string {
  return join(process.cwd(), 'uploads', 'motion-private');
}

export function isMotionTextFilename(filename: string): boolean {
  return TEXT_FILE.test(filename);
}

export function isServerAudioFilename(filename: string): boolean {
  return AUDIO_FILE.test(filename);
}

export function isServerVideoFilename(filename: string): boolean {
  return VIDEO_FILE.test(filename);
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

/** Write a server-named stage, subtitle line, or concat-list file. The name is not taken from a request. */
export function writeProjectText(projectId: string, filename: string, text: string): string {
  if (!isMotionTextFilename(filename)) {
    throw new BadRequestException('Invalid motion text name');
  }
  const dir = ensureProjectDir(projectId);
  const absolute = resolveUnderRoot(dir, filename);
  writeFileSync(absolute, text);
  return absolute;
}

/** Write one server-named PNG frame. The name is not taken from a request. */
export function writeProjectBytes(projectId: string, filename: string, bytes: Buffer): string {
  if (!FRAME_FILE.test(filename) || bytes.length < 8) {
    throw new BadRequestException('Invalid motion frame');
  }
  const dir = ensureProjectDir(projectId);
  const absolute = resolveUnderRoot(dir, filename);
  writeFileSync(absolute, bytes);
  return absolute;
}

/**
 * Write audio that already passed the MIME, size, and magic-byte checks.
 * The filename is the server-chosen name from that check, under the private motion directory.
 */
export function writeProjectAudio(projectId: string, filename: string, bytes: Buffer): string {
  const detected = detectAudioMime(bytes);
  const extension = detected ? extensionForMime(detected) : null;
  if (
    !isServerAudioFilename(filename) ||
    !extension ||
    !filename.endsWith(extension) ||
    bytes.length === 0 ||
    bytes.length > MOTION_LIMITS.audioBytes
  ) {
    throw new BadRequestException('Invalid motion audio');
  }
  const dir = ensureProjectDir(projectId);
  const absolute = resolveUnderRoot(dir, filename);
  writeFileSync(absolute, bytes);
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
    if (
      name.endsWith('.svg') ||
      name.startsWith('seg-') ||
      name.startsWith('line-') ||
      name.startsWith('frame-') ||
      (name.startsWith('stage-') && name.endsWith('.html')) ||
      name === 'silent.mp4' ||
      name === 'list.txt'
    ) {
      unlinkSync(join(dir, name));
    }
  }
}

export function fileSize(absolute: string): number {
  return statSync(absolute).size;
}
