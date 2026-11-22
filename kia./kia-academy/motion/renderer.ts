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

const SANS_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const MONO_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';

function frameText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[•●▪‣]/g, '-');
}

function wrapLines(text: string, width: number, maxLines: number): string[] {
  const words = frameText(text).split(/\n+/).flatMap((line) => {
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

function fontFor(mono: boolean): string {
  return mono ? MONO_FONT : SANS_FONT;
}

/** One drawtext per line. librsvg does not shape Arabic, so frames use ffmpeg drawtext. */
export function sceneDrawFilters(
  scene: RenderFrameScene,
  width: number,
  height: number,
  writeLine: (name: string, text: string) => string,
): string {
  const titleWidth = Math.max(16, Math.floor((width - 160) / 28));
  const bodyWidth = Math.max(18, Math.floor((width - 160) / 18));
  const title = wrapLines(scene.onScreenText || scene.title, titleWidth, 2);
  const code = frameText(scene.code)
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => line.trimEnd().slice(0, 78))
    .filter((line) => line.trim().length > 0)
    .slice(0, 8);
  const bodyBudget = Math.max(2, Math.floor((height - 240 - code.length * 36) / 52));
  const narration = wrapLines(scene.narration, bodyWidth, scene.code ? Math.min(4, bodyBudget) : bodyBudget);
  const filters = [`drawbox=x=0:y=0:w=18:h=ih:color=0xe6e1d6:t=fill`];
  const push = (name: string, text: string, font: string, size: number, color: string, x: string, y: number) => {
    const file = writeLine(name, text);
    filters.push(
      `drawtext=expansion=none:fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`,
    );
  };
  title.forEach((line, index) => {
    push(`title-${index}.txt`, line, fontFor(false), 46, '0xf4f1ea', 'w-text_w-72', 110 + index * 64);
  });
  narration.forEach((line, index) => {
    push(`body-${index}.txt`, line, fontFor(false), 30, '0xd9d4c8', 'w-text_w-72', 250 + index * 52);
  });
  if (scene.code && scene.codeSource === 'instructor') {
    push('instructor.txt', 'ویرایش مدرس', SANS_FONT, 24, '0xe6c07b', '72', 72);
  }
  code.forEach((line, index) => {
    const y = height - 64 - (code.length - index) * 34;
    push(`code-${index}.txt`, line, MONO_FONT, 22, '0xd7e6c8', '72', y);
  });
  return filters.join(',');
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
  if (!existsSync(SANS_FONT) || !existsSync(MONO_FONT)) {
    throw new Error(
      `Frame fonts are missing (${SANS_FONT}, ${MONO_FONT}). Install fonts-dejavu-core. See docs/MOTION_STUDIO.md.`,
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
    const segmentName = `seg-${index}.mp4`;
    const segmentPath = projectFile(request.projectId, segmentName);
    const filters = sceneDrawFilters(scene, request.width, request.height, (name, text) =>
      writeProjectFile(request.projectId, `line-${index}-${name}`, text),
    );
    const duration = String(Math.max(1, scene.durationSec));
    await runFfmpeg(
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `color=c=0x14161c:s=${request.width}x${request.height}:d=${duration}:r=${request.fps}`,
        '-vf',
        filters,
        '-t',
        duration,
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
