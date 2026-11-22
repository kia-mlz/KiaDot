export type MotionAnimationType = 'kinetic' | 'code' | 'split' | 'motion';

export interface MotionWarning {
  code: string;
  message: string;
}

export interface LessonAttachmentRef {
  title: string;
  fileName?: string | null;
}

/** Real lesson fields the analyzer is allowed to read. It must not invent definitions. */
export interface LessonSource {
  title: string;
  content: string;
  contentEn?: string | null;
  courseTitle: string;
  courseDescription: string;
  chapterTitle?: string | null;
  attachments?: LessonAttachmentRef[];
}

export interface AnalyzedScene {
  title: string;
  narration: string;
  narrationEn: string;
  onScreenText: string;
  durationSec: number;
  animationType: MotionAnimationType;
  code: string;
  codeLanguage: string;
  codeSource: 'lesson' | 'instructor';
  sourceStart: number;
  sourceEnd: number;
  sourceAnchor: string;
  warnings: MotionWarning[];
}

export interface LessonAnalysis {
  concepts: string[];
  warnings: MotionWarning[];
  scenes: AnalyzedScene[];
  suggestedStyle: MotionAnimationType;
  providerId: string;
  model: string;
  tokens: number;
}

export interface AnalyzeOptions {
  temperature?: number;
  maxTokens?: number;
  sceneCountHint?: number;
  targetDurationSec?: number;
}

export interface LessonMotionAnalyzer {
  readonly providerId: string;
  readonly model: string;
  analyze(source: LessonSource, options?: AnalyzeOptions): Promise<LessonAnalysis>;
}

export interface MotionAiEnv {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export function motionAiConfigured(env: MotionAiEnv): boolean {
  return Boolean(env.baseUrl?.trim() && env.apiKey?.trim() && env.model?.trim());
}
