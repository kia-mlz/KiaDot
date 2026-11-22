const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm', 'audio/ogg']);

export function sniffAudio(buffer: Buffer, declaredMime: string): string | null {
  if (!AUDIO_MIMES.has(declaredMime)) return null;
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (buffer[0] === 0xff && buffer[1] !== undefined && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'audio/wav';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return null;
  const head = buffer.subarray(0, 16).toString('ascii');
  if (head.includes('ftyp')) return 'audio/mp4';
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'audio/webm';
  return null;
}

export function extensionForMime(mime: string): string {
  if (mime === 'audio/mpeg') return '.mp3';
  if (mime === 'audio/wav') return '.wav';
  if (mime === 'audio/ogg') return '.ogg';
  if (mime === 'audio/webm') return '.webm';
  return '.m4a';
}

export function ttsConfigured(env: { baseUrl?: string; apiKey?: string; model?: string }): boolean {
  return Boolean(env.baseUrl?.trim() && env.apiKey?.trim() && env.model?.trim());
}
