import { motionAiConfigured, type LessonAnalysis, type LessonMotionAnalyzer, type LessonSource, type MotionAiEnv, type MotionAnimationType, type MotionWarning } from './types';
import type { AnalyzeOptions } from './types';
import { DeterministicLessonAnalyzer } from './deterministic-lesson-analyzer';

const ANIMATIONS = new Set<MotionAnimationType>(['kinetic', 'code', 'split', 'motion']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Keep only provider output that is grounded in the stored lesson.
 * Invented narration or code is dropped. An empty result throws so the job fails
 * instead of being replaced with a fake storyboard.
 */
export function normalizeProviderAnalysis(raw: unknown, source: LessonSource): LessonAnalysis {
  const record = asRecord(raw);
  const list = record && Array.isArray(record.scenes) ? record.scenes : null;
  if (!list) {
    throw new Error('AI provider returned a response without scenes');
  }
  const warnings: MotionWarning[] = [];
  const content = source.content ?? '';
  const contentEn = source.contentEn ?? '';
  const allowedNarration = [content, contentEn, source.title, source.courseTitle, source.courseDescription, source.chapterTitle ?? '']
    .filter(Boolean)
    .join('\n');

  const scenes = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    let narration = asString(row.narration).trim();
    let narrationEn = asString(row.narrationEn).trim();
    let code = asString(row.code);
    const codeLanguage = asString(row.codeLanguage).slice(0, 32);
    if (narration && !allowedNarration.includes(narration)) narration = '';
    if (narrationEn && !allowedNarration.includes(narrationEn)) narrationEn = '';
    if (code && !content.includes(code)) {
      code = '';
      warnings.push({
        code: 'provider_code_rejected',
        message: 'کدی که مدل برگرداند در متن درس نبود و حذف شد.',
      });
    }
    if (!narration && !code) continue;
    let sourceStart = Number(row.sourceStart);
    let sourceEnd = Number(row.sourceEnd);
    const rangeOk =
      Number.isInteger(sourceStart) &&
      Number.isInteger(sourceEnd) &&
      sourceStart >= 0 &&
      sourceEnd <= content.length &&
      sourceStart <= sourceEnd;
    if (!rangeOk) {
      const needle = narration || code;
      const at = needle ? content.indexOf(needle) : -1;
      if (at < 0) continue;
      sourceStart = at;
      sourceEnd = at + needle.length;
    }
    const requested = asString(row.animationType) as MotionAnimationType;
    const animationType: MotionAnimationType = code
      ? ANIMATIONS.has(requested)
        ? requested
        : 'code'
      : ANIMATIONS.has(requested)
        ? requested
        : 'kinetic';
    const duration = Number(row.durationSec);
    scenes.push({
      title: asString(row.title).slice(0, 120) || narration.slice(0, 80) || 'صحنه',
      narration,
      narrationEn,
      onScreenText: asString(row.onScreenText).slice(0, 600) || asString(row.title).slice(0, 90),
      durationSec: Number.isFinite(duration) ? Math.max(3, Math.min(40, Math.round(duration))) : 6,
      animationType,
      code,
      codeLanguage,
      codeSource: 'lesson' as const,
      sourceStart,
      sourceEnd,
      sourceAnchor: code ? `code:${codeLanguage}:${sourceStart}` : `text:${sourceStart}`,
      warnings: [],
    });
  }

  if (!scenes.length) {
    throw new Error('AI provider returned no usable scenes grounded in the lesson');
  }

  const extraWarnings = Array.isArray(record?.warnings) ? record.warnings : [];
  for (const warning of extraWarnings) {
    if (typeof warning === 'string' && warning.trim()) {
      warnings.push({ code: 'provider_note', message: warning.trim().slice(0, 400) });
    }
  }
  const concepts = Array.isArray(record?.concepts)
    ? record.concepts.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 12)
    : [];

  return {
    concepts,
    warnings,
    scenes,
    suggestedStyle: scenes.some((scene) => scene.animationType === 'split')
      ? 'split'
      : scenes.some((scene) => scene.code)
        ? 'code'
        : 'kinetic',
    providerId: 'openai-compatible',
    model: '',
    tokens: 0,
  };
}

export function readUsageTokens(payload: unknown): number {
  const record = asRecord(payload);
  const usage = asRecord(record?.usage);
  const total = usage?.total_tokens;
  return typeof total === 'number' && Number.isFinite(total) ? total : 0;
}

export class OpenAiCompatibleAnalyzer implements LessonMotionAnalyzer {
  readonly providerId = 'openai-compatible';
  readonly model: string;

  constructor(private readonly env: Required<Pick<MotionAiEnv, 'baseUrl' | 'apiKey' | 'model'>>) {
    this.model = env.model;
  }

  async analyze(source: LessonSource, options: AnalyzeOptions = {}): Promise<LessonAnalysis> {
    const base = this.env.baseUrl.replace(/\/$/, '');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: this.env.model,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You segment a stored lesson into storyboard scenes. Return JSON only. ' +
              'Narration and code must be exact substrings of the lesson. Do not invent definitions or sample code. ' +
              'sourceStart and sourceEnd are indexes into the lesson content. ' +
              'Shape: {"concepts":string[],"warnings":string[],"scenes":[{"title","narration","narrationEn","onScreenText","durationSec","animationType","code","codeLanguage","sourceStart","sourceEnd"}]}',
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: source.title,
              courseTitle: source.courseTitle,
              courseDescription: source.courseDescription,
              chapterTitle: source.chapterTitle ?? null,
              attachments: source.attachments ?? [],
              content: source.content,
              contentEn: source.contentEn ?? null,
              sceneCountHint: options.sceneCountHint ?? 0,
              targetDurationSec: options.targetDurationSec ?? 0,
            }),
          },
        ],
      }),
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`AI provider HTTP ${response.status}: ${bodyText.slice(0, 400)}`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error('AI provider returned invalid JSON');
    }
    const record = asRecord(payload);
    const message = asRecord(asRecord(Array.isArray(record?.choices) ? record.choices[0] : null)?.message);
    const content = asString(message?.content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI provider message was not JSON');
    }
    const analysis = normalizeProviderAnalysis(parsed, source);
    analysis.model = this.model;
    analysis.tokens = readUsageTokens(payload);
    return analysis;
  }
}

export function selectLessonAnalyzer(env: MotionAiEnv): LessonMotionAnalyzer {
  if (motionAiConfigured(env) && env.baseUrl && env.apiKey && env.model) {
    return new OpenAiCompatibleAnalyzer({
      baseUrl: env.baseUrl.trim(),
      apiKey: env.apiKey.trim(),
      model: env.model.trim(),
    });
  }
  return new DeterministicLessonAnalyzer();
}
