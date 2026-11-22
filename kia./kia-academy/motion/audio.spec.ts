import { BadRequestException } from '@nestjs/common';
import { detectAudioMime, inspectMotionTts, inspectMotionUpload, sniffAudio } from './audio';
import { MOTION_LIMITS } from './policy';
import { isServerAudioFilename, writeProjectAudio } from './storage';

function bytes(value: string | number[]): Buffer {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : value);
  if (buffer.length >= 12) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(12 - buffer.length)]);
}

const id3 = bytes('ID3' + ' '.repeat(9));
const wav = bytes('RIFF....WAVE');
const html = bytes('<html></html>');

describe('motion audio inspection', () => {
  it('stores a copy under a server-chosen name and ignores the client filename', () => {
    const accepted = inspectMotionUpload({
      buffer: id3,
      mimetype: 'audio/mpeg',
      size: id3.length,
    });
    expect(accepted.bytes.equals(id3)).toBe(true);
    expect(accepted.bytes).not.toBe(id3);
    expect(accepted.mime).toBe('audio/mpeg');
    expect(accepted.filename).toMatch(
      /^narration-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$/,
    );
    expect(accepted.filename).not.toContain('passwd');
    expect(isServerAudioFilename(accepted.filename)).toBe(true);
  });

  it('accepts wav when the declared type is audio/x-wav', () => {
    const accepted = inspectMotionUpload({ buffer: wav, mimetype: 'audio/x-wav', size: wav.length });
    expect(accepted.mime).toBe('audio/wav');
    expect(accepted.filename.endsWith('.wav')).toBe(true);
  });

  it('rejects a declared type that does not match the leading bytes', () => {
    expect(sniffAudio(wav, 'audio/mpeg')).toBeNull();
    expect(() => inspectMotionUpload({ buffer: wav, mimetype: 'audio/mpeg', size: wav.length })).toThrow(
      BadRequestException,
    );
  });

  it('rejects HTML and other types that are not allowlisted audio', () => {
    expect(detectAudioMime(html)).toBeNull();
    expect(() =>
      inspectMotionUpload({ buffer: html, mimetype: 'text/html', size: html.length }),
    ).toThrow(BadRequestException);
    expect(() =>
      inspectMotionUpload({ buffer: html, mimetype: 'audio/mpeg', size: html.length }),
    ).toThrow(BadRequestException);
  });

  it('rejects a size that does not match the buffer or exceeds the cap', () => {
    expect(() => inspectMotionUpload({ buffer: id3, mimetype: 'audio/mpeg', size: id3.length - 1 })).toThrow(
      BadRequestException,
    );
    const huge = Buffer.concat([id3, Buffer.alloc(MOTION_LIMITS.audioBytes)]);
    expect(() => inspectMotionUpload({ buffer: huge, mimetype: 'audio/mpeg', size: huge.length })).toThrow(
      BadRequestException,
    );
  });

  it('does not write a TTS body that fails the magic-byte check', () => {
    expect(inspectMotionTts(html)).toBeNull();
    expect(inspectMotionTts(Buffer.alloc(0))).toBeNull();
    const accepted = inspectMotionTts(wav);
    expect(accepted?.mime).toBe('audio/wav');
    expect(accepted?.filename.startsWith('tts-')).toBe(true);
    expect(accepted?.bytes.equals(wav)).toBe(true);
    expect(accepted && accepted.bytes).not.toBe(wav);
  });

  it('refuses to write bytes that are not the inspected audio type', () => {
    expect(() => writeProjectAudio('project', '../narration.mp3', id3)).toThrow(BadRequestException);
    expect(() =>
      writeProjectAudio('project', 'narration-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.mp3', html),
    ).toThrow(BadRequestException);
  });
});
