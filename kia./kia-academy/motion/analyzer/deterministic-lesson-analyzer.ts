import type {
  AnalyzedScene,
  AnalyzeOptions,
  LessonAnalysis,
  LessonMotionAnalyzer,
  LessonSource,
  MotionAnimationType,
  MotionWarning,
} from './types';

interface LineSpan {
  line: string;
  start: number;
  end: number;
}

interface Block {
  kind: 'heading' | 'paragraph' | 'list' | 'code' | 'quote';
  start: number;
  end: number;
  text: string;
  language?: string;
}

const STRUCTURAL = /^(#{1,6}\s|```|>(?:\s|$)|\s*[-*+]\s|\s*\d+\.\s)/;

function lineSpans(content: string): LineSpan[] {
  const parts = content.split('\n');
  const spans: LineSpan[] = [];
  let offset = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const line = parts[i] ?? '';
    const start = offset;
    const exclusive = start + line.length;
    const end = i < parts.length - 1 ? exclusive + 1 : exclusive;
    spans.push({ line, start, end });
    offset = end;
  }
  return spans;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trim()}…`;
}

function durationFor(narration: string, code: string): number {
  const chars = narration.length + Math.min(code.length, 400);
  return Math.max(4, Math.min(24, Math.ceil(chars / 18) || 4));
}

function animationForLanguage(language: string): MotionAnimationType {
  const lang = language.toLowerCase();
  if (lang === 'html' || lang === 'css' || lang === 'svg') return 'split';
  if (lang) return 'code';
  return 'kinetic';
}

function suggestStyle(scenes: AnalyzedScene[]): MotionAnimationType {
  if (scenes.some((scene) => scene.animationType === 'split')) return 'split';
  if (scenes.some((scene) => scene.code)) return 'code';
  if (scenes.length > 6) return 'motion';
  return 'kinetic';
}

function parseBlocks(content: string, warnings: MotionWarning[]): Block[] {
  const lines = lineSpans(content);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    if (!current || current.line.trim() === '') {
      i += 1;
      continue;
    }
    const fence = /^```([^\s`]*)\s*$/.exec(current.line);
    if (fence) {
      let j = i + 1;
      const codeLines: string[] = [];
      let closed = false;
      while (j < lines.length) {
        const row = lines[j];
        if (row && /^```\s*$/.test(row.line)) {
          closed = true;
          break;
        }
        if (row) codeLines.push(row.line);
        j += 1;
      }
      if (!closed || !lines[j]) {
        warnings.push({
          code: 'unclosed_fence',
          message: 'یک بلوک کد بسته نشده است و به‌عنوان کد نمایش داده نشد.',
        });
        const last = lines[lines.length - 1];
        blocks.push({
          kind: 'paragraph',
          start: current.start,
          end: last?.end ?? current.end,
          text: content.slice(current.start, last?.end ?? current.end).trim(),
        });
        break;
      }
      blocks.push({
        kind: 'code',
        start: current.start,
        end: lines[j].end,
        text: codeLines.join('\n'),
        language: fence[1] || '',
      });
      i = j + 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(current.line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        start: current.start,
        end: current.end,
        text: heading[2] ?? current.line,
      });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(current.line)) {
      let j = i;
      while (j < lines.length && lines[j] && /^>\s?/.test(lines[j].line)) j += 1;
      const end = lines[j - 1]?.end ?? current.end;
      const text = content
        .slice(current.start, end)
        .split('\n')
        .map((row) => row.replace(/^>\s?/, ''))
        .join('\n')
        .trim();
      blocks.push({ kind: 'quote', start: current.start, end, text });
      i = j;
      continue;
    }

    if (/^(\s*[-*+]|\s*\d+\.)\s+/.test(current.line)) {
      let j = i;
      while (j < lines.length) {
        const row = lines[j];
        if (!row) break;
        if (/^(\s*[-*+]|\s*\d+\.)\s+/.test(row.line)) {
          j += 1;
          continue;
        }
        if (
          row.line.trim() === '' &&
          lines[j + 1] &&
          /^(\s*[-*+]|\s*\d+\.)\s+/.test(lines[j + 1]?.line ?? '')
        ) {
          j += 1;
          continue;
        }
        break;
      }
      while (j > i && lines[j - 1]?.line.trim() === '') j -= 1;
      const end = lines[j - 1]?.end ?? current.end;
      blocks.push({
        kind: 'list',
        start: current.start,
        end,
        text: content.slice(current.start, end).trim(),
      });
      i = j;
      continue;
    }

    let j = i + 1;
    while (j < lines.length) {
      const row = lines[j];
      if (!row || row.line.trim() === '' || STRUCTURAL.test(row.line)) break;
      j += 1;
    }
    const end = lines[j - 1]?.end ?? current.end;
    blocks.push({
      kind: 'paragraph',
      start: current.start,
      end,
      text: content.slice(current.start, end).trim(),
    });
    i = j;
  }
  return blocks;
}

function sceneFromParts(input: {
  title: string;
  narration: string;
  start: number;
  end: number;
  code?: string;
  language?: string;
  animationType?: MotionAnimationType;
}): AnalyzedScene {
  const code = input.code ?? '';
  const language = input.language ?? '';
  const animationType = input.animationType ?? (code ? animationForLanguage(language) : 'kinetic');
  return {
    title: clip(input.title, 120) || clip(input.narration, 80) || 'صحنه',
    narration: input.narration,
    narrationEn: '',
    onScreenText: clip(input.title, 90),
    durationSec: durationFor(input.narration, code),
    animationType,
    code,
    codeLanguage: language,
    codeSource: code ? 'lesson' : 'lesson',
    sourceStart: input.start,
    sourceEnd: input.end,
    sourceAnchor: code ? `code:${language}:${input.start}` : `text:${input.start}`,
    warnings: [],
  };
}

function foldBlocks(blocks: Block[], warnings: MotionWarning[]): AnalyzedScene[] {
  const scenes: AnalyzedScene[] = [];
  const headingBodies = new Map<string, string>();
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) continue;
    if (block.kind === 'heading') {
      const next = blocks[i + 1];
      if (next && (next.kind === 'paragraph' || next.kind === 'list' || next.kind === 'quote')) {
        const key = block.text.trim().toLowerCase();
        const previous = headingBodies.get(key);
        if (previous !== undefined && previous !== next.text) {
          warnings.push({
            code: 'duplicate_heading',
            message: `عنوان «${block.text.trim()}» بیش از یک بار با متن متفاوت آمده است. قبل از تأیید بررسی کنید.`,
          });
        } else {
          headingBodies.set(key, next.text);
        }
        scenes.push(
          sceneFromParts({
            title: block.text,
            narration: next.text,
            start: block.start,
            end: next.end,
          }),
        );
        i += 1;
        continue;
      }
      if (next?.kind === 'code') {
        scenes.push(
          sceneFromParts({
            title: block.text,
            narration: block.text,
            start: block.start,
            end: next.end,
            code: next.text,
            language: next.language,
          }),
        );
        i += 1;
        continue;
      }
      scenes.push(
        sceneFromParts({
          title: block.text,
          narration: block.text,
          start: block.start,
          end: block.end,
        }),
      );
      continue;
    }
    if (block.kind === 'code') {
      scenes.push(
        sceneFromParts({
          title: block.language ? block.language : 'کد درس',
          narration: '',
          start: block.start,
          end: block.end,
          code: block.text,
          language: block.language,
        }),
      );
      continue;
    }
    scenes.push(
      sceneFromParts({
        title: clip(block.text, 72),
        narration: block.text,
        start: block.start,
        end: block.end,
      }),
    );
  }
  return scenes;
}

function conceptsFrom(content: string, scenes: AnalyzedScene[]): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const heading = match[1]?.trim();
    if (heading) found.add(heading);
  }
  for (const match of content.matchAll(/\*\*([^*\n]{2,40})\*\*/g)) {
    const term = match[1]?.trim();
    if (term) found.add(term);
  }
  if (found.size === 0) {
    for (const scene of scenes) {
      if (scene.title) found.add(scene.title);
    }
  }
  return [...found].slice(0, 12);
}

function applyTargetDuration(scenes: AnalyzedScene[], target: number | undefined): void {
  if (!target || target < 8 || scenes.length === 0) return;
  const sum = scenes.reduce((total, scene) => total + scene.durationSec, 0);
  if (sum <= 0) return;
  const scale = target / sum;
  for (const scene of scenes) {
    scene.durationSec = Math.max(3, Math.min(40, Math.round(scene.durationSec * scale)));
  }
}

function mergeToHint(scenes: AnalyzedScene[], hint: number | undefined): AnalyzedScene[] {
  if (!hint || hint < 1 || scenes.length <= hint) return scenes;
  const next = scenes.map((scene) => ({ ...scene }));
  while (next.length > hint) {
    let merged = false;
    for (let i = 0; i < next.length - 1; i += 1) {
      const left = next[i];
      const right = next[i + 1];
      if (!left || !right || left.code || right.code) continue;
      next.splice(i, 2, {
        ...left,
        narration: [left.narration, right.narration].filter(Boolean).join('\n\n'),
        narrationEn: [left.narrationEn, right.narrationEn].filter(Boolean).join('\n\n'),
        sourceStart: Math.min(left.sourceStart, right.sourceStart),
        sourceEnd: Math.max(left.sourceEnd, right.sourceEnd),
        durationSec: Math.min(40, left.durationSec + right.durationSec),
        onScreenText: left.onScreenText || right.onScreenText,
      });
      merged = true;
      break;
    }
    if (!merged) break;
  }
  return next;
}

function alignEnglish(scenes: AnalyzedScene[], contentEn: string, warnings: MotionWarning[]): void {
  const english = contentEn.trim();
  if (!english) return;
  const enBlocks = parseBlocks(english, []);
  const enScenes = foldBlocks(enBlocks, []);
  if (enScenes.length !== scenes.length) {
    warnings.push({
      code: 'en_misaligned',
      message: 'متن انگلیسی با بخش‌های فارسی هم‌تراز نیست؛ روایت انگلیسی خالی ماند.',
    });
    return;
  }
  scenes.forEach((scene, index) => {
    const pair = enScenes[index];
    if (!pair) return;
    const sceneIsCode = Boolean(scene.code);
    const pairIsCode = Boolean(pair.code);
    if (sceneIsCode !== pairIsCode) return;
    scene.narrationEn = pair.narration || pair.code;
  });
}

function attachmentScene(source: LessonSource, contentLength: number): AnalyzedScene | null {
  const attachments = (source.attachments ?? []).filter((item) => item.title.trim());
  if (!attachments.length) return null;
  const narration = attachments.map((item) => item.title.trim()).join('\n');
  return {
    title: 'پیوست‌های درس',
    narration,
    narrationEn: '',
    onScreenText: 'پیوست‌ها',
    durationSec: durationFor(narration, ''),
    animationType: 'kinetic',
    code: '',
    codeLanguage: '',
    codeSource: 'lesson',
    sourceStart: contentLength,
    sourceEnd: contentLength,
    sourceAnchor: 'attachment',
    warnings: [],
  };
}

export function analyzeDeterministic(source: LessonSource, options: AnalyzeOptions = {}): LessonAnalysis {
  const content = source.content ?? '';
  const warnings: MotionWarning[] = [];
  if (!content.trim()) {
    warnings.push({ code: 'empty_content', message: 'متن درس خالی است.' });
    return {
      concepts: [],
      warnings,
      scenes: [],
      suggestedStyle: 'kinetic',
      providerId: 'deterministic',
      model: 'deterministic',
      tokens: 0,
    };
  }

  const blocks = parseBlocks(content, warnings);
  let scenes = foldBlocks(blocks, warnings);
  scenes = mergeToHint(scenes, options.sceneCountHint);
  alignEnglish(scenes, source.contentEn ?? '', warnings);
  const extra = attachmentScene(source, content.length);
  if (extra) scenes.push(extra);
  if (source.chapterTitle?.trim() && scenes[0]) {
    scenes[0].onScreenText = clip(`${source.chapterTitle.trim()} — ${scenes[0].title}`, 90);
  }
  applyTargetDuration(scenes, options.targetDurationSec);
  for (const scene of scenes) {
    if (scene.sourceStart < 0) scene.sourceStart = 0;
    if (scene.sourceEnd > content.length) scene.sourceEnd = content.length;
    if (scene.sourceEnd < scene.sourceStart) scene.sourceEnd = scene.sourceStart;
  }
  return {
    concepts: conceptsFrom(content, scenes),
    warnings,
    scenes,
    suggestedStyle: suggestStyle(scenes),
    providerId: 'deterministic',
    model: 'deterministic',
    tokens: 0,
  };
}

export class DeterministicLessonAnalyzer implements LessonMotionAnalyzer {
  readonly providerId = 'deterministic';
  readonly model = 'deterministic';

  analyze(source: LessonSource, options?: AnalyzeOptions): Promise<LessonAnalysis> {
    return Promise.resolve(analyzeDeterministic(source, options));
  }
}
