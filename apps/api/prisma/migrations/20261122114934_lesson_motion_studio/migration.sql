-- CreateEnum
CREATE TYPE "MotionProjectStatus" AS ENUM ('Draft', 'Analyzing', 'Storyboarding', 'AwaitingApproval', 'Rendering', 'Processing', 'Completed', 'Failed', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "MotionVideoPosition" AS ENUM ('BEFORE_BODY', 'AFTER_OBJECTIVES');

-- CreateEnum
CREATE TYPE "MotionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MotionVideoProject" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MotionProjectStatus" NOT NULL DEFAULT 'Draft',
    "style" TEXT NOT NULL DEFAULT 'kinetic',
    "styleLocked" BOOLEAN NOT NULL DEFAULT false,
    "aspect" TEXT NOT NULL DEFAULT '1920x1080',
    "fps" INTEGER NOT NULL DEFAULT 30,
    "quality" TEXT NOT NULL DEFAULT 'standard',
    "language" TEXT NOT NULL DEFAULT 'fa',
    "voiceId" TEXT NOT NULL DEFAULT '',
    "targetDurationSec" INTEGER NOT NULL DEFAULT 90,
    "sceneCountHint" INTEGER NOT NULL DEFAULT 0,
    "autoRender" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "videoVersion" INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT NOT NULL DEFAULT 'deterministic',
    "model" TEXT NOT NULL DEFAULT 'deterministic',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "concepts" JSONB NOT NULL DEFAULT '[]',
    "sourceSnapshot" TEXT NOT NULL DEFAULT '',
    "sourceSnapshotEn" TEXT NOT NULL DEFAULT '',
    "contextJson" JSONB NOT NULL DEFAULT '{}',
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "narrationAudioStatus" TEXT NOT NULL DEFAULT 'unconfigured',
    "parentProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotionVideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionScene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narration" TEXT NOT NULL DEFAULT '',
    "narrationEn" TEXT NOT NULL DEFAULT '',
    "onScreenText" TEXT NOT NULL DEFAULT '',
    "durationSec" INTEGER NOT NULL DEFAULT 6,
    "animationType" TEXT NOT NULL DEFAULT 'kinetic',
    "code" TEXT NOT NULL DEFAULT '',
    "codeLanguage" TEXT NOT NULL DEFAULT '',
    "codeSource" TEXT NOT NULL DEFAULT 'lesson',
    "sourceStart" INTEGER NOT NULL DEFAULT 0,
    "sourceEnd" INTEGER NOT NULL DEFAULT 0,
    "sourceAnchor" TEXT NOT NULL DEFAULT '',
    "warnings" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "MotionScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "videoVersion" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "videoPath" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "MotionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "errorLog" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionSubtitle" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MotionSubtitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionAudio" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "mime" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionLessonVideo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" "MotionVideoPosition" NOT NULL DEFAULT 'BEFORE_BODY',
    "videoFilename" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "videoVersion" INTEGER NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "minWatchPercent" INTEGER,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionLessonVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionVideoProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lastTimeSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MotionVideoProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionAiProviderSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotionAiProviderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionAiUsageLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "lessonId" TEXT,
    "projectId" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotionAiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotionTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "animationType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MotionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MotionVideoProject_courseId_idx" ON "MotionVideoProject"("courseId");

-- CreateIndex
CREATE INDEX "MotionVideoProject_lessonId_status_idx" ON "MotionVideoProject"("lessonId", "status");

-- CreateIndex
CREATE INDEX "MotionVideoProject_status_idx" ON "MotionVideoProject"("status");

-- CreateIndex
CREATE INDEX "MotionVideoProject_createdById_idx" ON "MotionVideoProject"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "MotionVideoProject_id_lessonId_key" ON "MotionVideoProject"("id", "lessonId");

-- CreateIndex
CREATE INDEX "MotionScene_projectId_sortOrder_idx" ON "MotionScene"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "MotionAsset_projectId_kind_idx" ON "MotionAsset"("projectId", "kind");

-- CreateIndex
CREATE INDEX "MotionVersion_projectId_createdAt_idx" ON "MotionVersion"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "MotionJob_status_createdAt_idx" ON "MotionJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MotionJob_projectId_createdAt_idx" ON "MotionJob"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MotionSubtitle_projectId_locale_format_key" ON "MotionSubtitle"("projectId", "locale", "format");

-- CreateIndex
CREATE INDEX "MotionAudio_projectId_idx" ON "MotionAudio"("projectId");

-- CreateIndex
CREATE INDEX "MotionLessonVideo_courseId_idx" ON "MotionLessonVideo"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "MotionLessonVideo_projectId_lessonId_key" ON "MotionLessonVideo"("projectId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "MotionLessonVideo_lessonId_key" ON "MotionLessonVideo"("lessonId");

-- CreateIndex
CREATE INDEX "MotionVideoProgress_lessonId_idx" ON "MotionVideoProgress"("lessonId");

-- CreateIndex
CREATE INDEX "MotionVideoProgress_userId_lessonId_idx" ON "MotionVideoProgress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "MotionVideoProgress_userId_projectId_key" ON "MotionVideoProgress"("userId", "projectId");

-- CreateIndex
CREATE INDEX "MotionAiUsageLog_lessonId_createdAt_idx" ON "MotionAiUsageLog"("lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "MotionAiUsageLog_createdAt_idx" ON "MotionAiUsageLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MotionTemplate_key_key" ON "MotionTemplate"("key");

-- AddForeignKey
ALTER TABLE "MotionVideoProject" ADD CONSTRAINT "MotionVideoProject_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVideoProject" ADD CONSTRAINT "MotionVideoProject_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVideoProject" ADD CONSTRAINT "MotionVideoProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVideoProject" ADD CONSTRAINT "MotionVideoProject_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "MotionVideoProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionScene" ADD CONSTRAINT "MotionScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionAsset" ADD CONSTRAINT "MotionAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVersion" ADD CONSTRAINT "MotionVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionJob" ADD CONSTRAINT "MotionJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionSubtitle" ADD CONSTRAINT "MotionSubtitle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionAudio" ADD CONSTRAINT "MotionAudio_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionLessonVideo" ADD CONSTRAINT "MotionLessonVideo_projectId_lessonId_fkey" FOREIGN KEY ("projectId", "lessonId") REFERENCES "MotionVideoProject"("id", "lessonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionLessonVideo" ADD CONSTRAINT "MotionLessonVideo_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVideoProgress" ADD CONSTRAINT "MotionVideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MotionVideoProgress" ADD CONSTRAINT "MotionVideoProgress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MotionVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Non-secret defaults. API keys stay in server env, not in this table.
INSERT INTO "MotionAiProviderSettings" ("id", "temperature", "maxTokens", "updatedAt")
VALUES ('default', 0.2, 2000, CURRENT_TIMESTAMP);

INSERT INTO "MotionTemplate" ("id", "key", "name", "animationType", "description") VALUES
  ('motion_tpl_kinetic', 'kinetic', 'Kinetic type', 'kinetic', 'Title and narration cards from the lesson text'),
  ('motion_tpl_code', 'code', 'Code reveal', 'code', 'Code taken from a fenced block in the lesson'),
  ('motion_tpl_split', 'split', 'Split code and result', 'split', 'HTML or CSS beside a sandboxed preview'),
  ('motion_tpl_motion', 'motion', 'Motion layout', 'motion', 'Full-frame motion graphics layout');
