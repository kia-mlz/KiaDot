import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { ChromeFrames } from './chrome-frames';
import { planSceneVisual } from './scene-plan';
import { buildStageDocument } from './stage-html';
import { isServerAudioFilename, isServerVideoFilename, projectFile, writeProjectBytes, writeProjectText } from './storage';

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

/** Capture rate for the moving frames. ffmpeg repeats them up to the project fps. */
const CAPTURE_FPS = 8;

const FRAME_FONTS = [
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
];

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
  const missing = FRAME_FONTS.filter((font) => !existsSync(font));
  if (missing.length) {
    throw new Error(
      `Frame fonts are missing (${missing.join(', ')}). Install fonts-noto-core and fonts-dejavu-core. See docs/MOTION_STUDIO.md.`,
    );
  }
}

function frameCount(durationSec: number): number {
  return Math.max(8, Math.round(Math.max(1, durationSec) * CAPTURE_FPS));
}

async function encodeSegment(request: RenderRequest, sceneIndex: number, durationSec: number): Promise<void> {
  const pattern = projectFile(request.projectId, `frame-${sceneIndex}-%04d.png`);
  const segmentPath = projectFile(request.projectId, `seg-${sceneIndex}.mp4`);
  await runFfmpeg(
    [
      '-y',
      '-framerate',
      String(CAPTURE_FPS),
      '-start_number',
      '1',
      '-i',
      pattern,
      '-t',
      String(durationSec),
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
}

export async function renderStoryboard(request: RenderRequest): Promise<{ bytes: number; filename: string }> {
  if (!request.scenes.length) {
    throw new Error('Cannot render a storyboard with no scenes');
  }
  if (!isServerVideoFilename(request.outputFilename)) {
    throw new Error('Rendered video name must be chosen by the server');
  }
  if (request.audioFilename && !isServerAudioFilename(request.audioFilename)) {
    throw new Error('Narration audio name must be chosen by the server');
  }
  assertFrameFonts();
  if (request.signal.aborted) throw new Error('MOTION_CANCELLED');

  const chrome = await ChromeFrames.launch(request.signal);
  const segmentNames: string[] = [];
  try {
    for (let index = 0; index < request.scenes.length; index += 1) {
      if (request.signal.aborted) throw new Error('MOTION_CANCELLED');
      const scene = request.scenes[index];
      if (!scene) continue;
      const durationSec = Math.max(1, scene.durationSec);
      const plan = planSceneVisual(scene);
      const html = buildStageDocument(plan, scene, {
        play: false,
        width: request.width,
        height: request.height,
      });
      const stagePath = writeProjectText(request.projectId, `stage-${index}.html`, html);
      await chrome.show(stagePath, request.width, request.height);
      const frames = frameCount(durationSec);
      for (let frame = 1; frame <= frames; frame += 1) {
        if (request.signal.aborted) throw new Error('MOTION_CANCELLED');
        const progress = frames === 1 ? 1 : (frame - 1) / (frames - 1);
        await chrome.seek(progress);
        const png = await chrome.png();
        const name = `frame-${index}-${String(frame).padStart(4, '0')}.png`;
        writeProjectBytes(request.projectId, name, png);
      }
      await encodeSegment(request, index, durationSec);
      segmentNames.push(`seg-${index}.mp4`);
    }
  } finally {
    await chrome.close();
  }

  const list = segmentNames.map((name) => `file '${name}'`).join('\n');
  const listPath = writeProjectText(request.projectId, 'list.txt', `${list}\n`);
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
    await runFfmpeg(['-y', '-i', silentPath, '-c', 'copy', '-movflags', '+faststart', outputPath], request.signal);
  }

  const bytes = statSync(outputPath).size;
  if (bytes < 1024) {
    throw new Error(`Rendered file is too small (${bytes} bytes) to be a valid lesson video`);
  }
  return { bytes, filename: request.outputFilename };
}
