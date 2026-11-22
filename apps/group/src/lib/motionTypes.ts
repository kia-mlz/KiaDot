export interface MotionWarning {
  code: string;
  message: string;
}

export interface MotionDashboard {
  produced: number;
  inProgress: number;
  awaitingApproval: number;
  published: number;
  failed: number;
  draft: number;
  archived: number;
  aiUsage: number;
}

export interface MotionSettings {
  temperature: number;
  maxTokens: number;
  aiConfigured: boolean;
  aiProvider: string;
  aiModel: string;
  ttsConfigured: boolean;
  ttsStatus: string;
}

export interface MotionCatalogCourse {
  id: string;
  title: string;
  slug: string;
  description: string;
  attachments: { id: string; title: string; fileName: string }[];
  lessons: { id: string; title: string; slug: string; chapterTitle: string | null }[];
}

export interface MotionScene {
  id: string;
  sortOrder: number;
  title: string;
  narration: string;
  narrationEn: string;
  onScreenText: string;
  durationSec: number;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
  sourceStart: number;
  sourceEnd: number;
  sourceAnchor: string;
}

export interface MotionJob {
  id: string;
  kind: string;
  status: string;
  cancelRequested: boolean;
  errorLog: string;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface MotionProject {
  id: string;
  courseId: string;
  lessonId: string;
  courseTitle: string;
  courseDescription: string;
  lessonTitle: string;
  chapterTitle: string | null;
  title: string;
  status: string;
  style: string;
  styleLocked: boolean;
  suggestedStyle: string;
  aspect: string;
  fps: number;
  quality: string;
  language: string;
  voiceId: string;
  targetDurationSec: number;
  sceneCountHint: number;
  autoRender: boolean;
  contentHash: string;
  contentVersion: number;
  videoVersion: number;
  providerId: string;
  model: string;
  warnings: MotionWarning[];
  concepts: string[];
  stale: boolean;
  approvedAt: string | null;
  narrationAudioStatus: string;
  position: 'BEFORE_BODY' | 'AFTER_OBJECTIVES';
  minWatchPercent: number | null;
  published: boolean;
  videoFilename: string | null;
  attachments: { title: string; fileName: string }[];
  scenes: MotionScene[];
  jobs: MotionJob[];
  subtitles: { locale: string; format: string; body: string; edited: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface MotionProjectSummary {
  id: string;
  title: string;
  status: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  stale: boolean;
  videoVersion: number;
  contentVersion: number;
  published: boolean;
  updatedAt: string;
}

export interface PublishedMotionVideo {
  projectId: string;
  lessonId: string;
  position: 'BEFORE_BODY' | 'AFTER_OBJECTIVES';
  videoUrl: string;
  stale: boolean;
  videoVersion: number;
  contentVersion: number;
  minWatchPercent: number | null;
  narrationAudioAttached: boolean;
  narrationAudioStatus: string;
  scenes: {
    id: string;
    title: string;
    startSec: number;
    endSec: number;
    sourceStart: number;
    sourceEnd: number;
    narration: string;
  }[];
  subtitles: { locale: string; vtt: string }[];
  progress: {
    lastTimeSec: number;
    percent: number;
    completed: boolean;
    viewCount: number;
    lastViewedAt: string;
  } | null;
}

export interface MotionProgress {
  lastTimeSec: number;
  percent: number;
  completed: boolean;
  viewCount: number;
  lastViewedAt: string;
}
