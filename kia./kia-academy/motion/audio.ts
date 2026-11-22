import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { MOTION_LIMITS } from './policy';

const DECLARED_TO_CANONICAL: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/mp4': 'audio/mp4',
  'audio/webm': 'audio/webm',
  'audio/ogg': 'audio/ogg',
};

export interface InspectedMotionAudio {
  bytes: Buffer;
  mime: string;
  filename: string;
}

export function detectAudioMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (buffer[0] === 0xff && buffer[1] !== undefined && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'audio/wav';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return null;
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'audio/webm';
  return null;
}

/** Declared type and leading bytes must name the same allowlisted audio type. */
export function sniffAudio(buffer: Buffer, declaredMime: string): string | null {
  const expected = DECLARED_TO_CANONICAL[declaredMime];
  if (!expected) return null;
  const detected = detectAudioMime(buffer);
  if (detected !== expected) return null;
  return detected;
}

export function extensionForMime(mime: string): string | null {
  if (mime === 'audio/mpeg') return '.mp3';
  if (mime === 'audio/wav') return '.wav';
  if (mime === 'audio/ogg') return '.ogg';
  if (mime === 'audio/webm') return '.webm';
  if (mime === 'audio/mp4') return '.m4a';
  return null;
}

function serverAudioName(kind: 'narration' | 'tts', mime: string): string | null {
  const extension = extensionForMime(mime);
  if (!extension) return null;
  return `${kind}-${randomUUID()}${extension}`;
}

/**
 * Copy an upload only when its declared type, size, and magic bytes agree.
 * The stored name is generated here. `originalname` is never read.
 */
export function inspectMotionUpload(file: {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}): InspectedMotionAudio {
  if (!file?.buffer?.length) {
    throw new BadRequestException('فایل صوتی لازم است.');
  }
  if (file.size !== file.buffer.length || file.buffer.length > MOTION_LIMITS.audioBytes) {
    throw new BadRequestException('حجم صدا باید حداکثر ۲۰ مگابایت باشد.');
  }
  const bytes = Buffer.from(file.buffer);
  const mime = sniffAudio(bytes, file.mimetype ?? '');
  const filename = mime ? serverAudioName('narration', mime) : null;
  if (!mime || !filename) {
    throw new BadRequestException('نوع فایل صوتی مجاز نیست.');
  }
  return { bytes, mime, filename };
}

/** Copy a TTS response only when its leading bytes are an allowlisted audio type and it fits the size cap. */
export function inspectMotionTts(buffer: Buffer): InspectedMotionAudio | null {
  if (buffer.length === 0 || buffer.length > MOTION_LIMITS.audioBytes) return null;
  const bytes = Buffer.from(buffer);
  const mime = detectAudioMime(bytes);
  const filename = mime ? serverAudioName('tts', mime) : null;
  if (!mime || !filename) return null;
  return { bytes, mime, filename };
}

export function ttsConfigured(env: { baseUrl?: string; apiKey?: string; model?: string }): boolean {
  return Boolean(env.baseUrl?.trim() && env.apiKey?.trim() && env.model?.trim());
}
