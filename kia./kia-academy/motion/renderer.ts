import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { projectFile, writeProjectFile } from './storage';

export interface RenderFrameScene {
  title: string;
  narration: string;
  onScreenText: string;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
  durationSec: number;
}

export interface RenderRequest {
  projectId: string;
  scenes: RenderFrameScene[];
  width: number;
  height: number;
  fps: 24 | 30;
  crf: number;
  outputFilename: string;
  audioFilename?: string | null;
  signal: AbortSignal;
}

const ARABIC_FONT = '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf';
const MONO_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text: string, width: number, maxLines: number): string[] {
  const words = text.replace(/\r/g, '').split(/\n+/).flatMap((line) => {
    const parts: string[] = [];
    let current = '';
    for (const word of line.split(/\s+/)) {
      if (!word) continue;
      const next = current ? `${current} ${word}` : word;
      if (next.length > width && current) {
        parts.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) parts.push(current);
    return parts.length ? parts : [''];
  });
  return words.filter((line) => line.trim().length > 0).slice(0, maxLines);
}

export function sceneSvg(scene: RenderFrameScene, width: number, height: number): string {
  const title = wrapLines(scene.onScreenText || scene.title, 42, 2);
  const narration = wrapLines(scene.narration, scene.code ? 36 : 48, scene.code ? 4 : 8);
  const code = scene.code
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => line.slice(0, 72))
    .slice(0, 12);
  const instructor = scene.code && scene.codeSource === 'instructor' ? 'ویرایش مدرس' : '';
  const titleSvg = title
    .map(
      (line, index) =>
        `<text x="${width - 80}" y="${140 + index * 64}" text-anchor="end" fill="#f4f1ea" font-family="Noto Naskh Arabic" font-size="48">${escapeXml(line)}</text>`,
    )
    .join('');
  const bodySvg = narration
    .map(
      (line, index) =>
        `<text x="${width - 80}" y="${280 + index * 42}" text-anchor="end" fill="#d9d4c8" font-family="Noto Naskh Arabic" font-size="28">${escapeXml(line)}</text>`,
    )
    .join('');
  const codeSvg = code
    .map(
      (line, index) =>
        `<text x="72" y="${height - 80 - (code.length - index) * 32}" fill="#d7e6c8" font-family="DejaVu Sans Mono" font-size="22">${escapeXml(line)}</text>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#14161c"/>
  <rect x="0" y="0" width="18" height="100%" fill="#e6e1d6"/>
  ${titleSvg}
  ${bodySvg}
  ${instructor ? `<text x="72" y="80" fill="#e6c07b" font-family="Noto Naskh Arabic" font-size="24">${escapeXml(instructor)}</text>` : ''}
  ${codeSvg}
</svg>`;
}

function runFfmpeg(args: string[], signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const onAbort = () => {
      child.kill('SIGKILL');
    };
    if (signal.aborted) {
      child.kill('SIGKILL');
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      signal.removeEventListener('abort', onAbort);
      if (error.code === 'ENOENT') {
        reject(new Error('ffmpeg is not installed. See docs/MOTION_STUDIO.md.'));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort);
      if (signal.aborted) {
        reject(new Error('MOTION_CANCELLED'));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

export async function assertFfmpegAvailable(): Promise<void> {
  await runFfmpeg(['-version'], new AbortController().signal);
}

export function assertFrameFonts(): void {
  if (!existsSync(ARABIC_FONT) || !existsSync(MONO_FONT)) {
    throw new Error(
      `Frame fonts are missing (${ARABIC_FONT}, ${MONO_FONT}). Install fonts-noto-core and fonts-dejavu-core. See docs/MOTION_STUDIO.md.`,
    );
  }
}

export async function renderStoryboard(request: RenderRequest): Promise<{ bytes: number; filename: string }> {
  if (!request.scenes.length) {
    throw new Error('Cannot render a storyboard with no scenes');
  }
  assertFrameFonts();
  if (request.signal.aborted) throw new Error('MOTION_CANCELLED');

  const segmentNames: string[] = [];
  for (let index = 0; index < request.scenes.length; index += 1) {
    if (request.signal.aborted) throw new Error('MOTION_CANCELLED');
    const scene = request.scenes[index];
    if (!scene) continue;
    const svgName = `frame-${index}.svg`;
    const segmentName = `seg-${index}.mp4`;
    const svgPath = writeProjectFile(request.projectId, svgName, sceneSvg(scene, request.width, request.height));
    const segmentPath = projectFile(request.projectId, segmentName);
    await runFfmpeg(
      [
        '-y',
        '-loop',
        '1',
        '-i',
        svgPath,
        '-t',
        String(Math.max(1, scene.durationSec)),
        '-vf',
        `scale=${request.width}:${request.height},format=yuv420p`,
        '-r',
        String(request.fps),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        String(request.crf),
        '-movflags',
        '+faststart',
        segmentPath,
      ],
      request.signal,
    );
    segmentNames.push(segmentName);
  }

  const list = segmentNames.map((name) => `file '${name}'`).join('\n');
  const listPath = writeProjectFile(request.projectId, 'list.txt', `${list}\n`);
  const silentPath = projectFile(request.projectId, 'silent.mp4');
  await runFfmpeg(
    ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', silentPath],
    request.signal,
  );

  const outputPath = projectFile(request.projectId, request.outputFilename);
  if (request.audioFilename) {
    const audioPath = projectFile(request.projectId, request.audioFilename);
    if (!existsSync(audioPath)) {
      throw new Error('Narration audio file is missing on disk');
    }
    await runFfmpeg(
      [
        '-y',
        '-i',
        silentPath,
        '-i',
        audioPath,
        '-filter_complex',
        '[1:a]apad[a]',
        '-map',
        '0:v:0',
        '-map',
        '[a]',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-shortest',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      request.signal,
    );
  } else {
    await runFfmpeg(
      ['-y', '-i', silentPath, '-c', 'copy', '-movflags', '+faststart', outputPath],
      request.signal,
    );
  }

  const bytes = statSync(outputPath).size;
  if (bytes < 1024) {
    throw new Error(`Rendered file is too small (${bytes} bytes) to be a valid lesson video`);
  }
  return { bytes, filename: request.outputFilename };
}
