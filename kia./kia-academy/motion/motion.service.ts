import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isFreePreviewLessonIndex } from '@kia./shared';
import { Prisma, PrismaService } from '@kia./platform';
import { selectLessonAnalyzer } from './analyzer/openai-compatible-analyzer';
import { motionAiConfigured, type LessonSource, type MotionWarning } from './analyzer/types';
import { inspectMotionTts, inspectMotionUpload, ttsConfigured } from './audio';
import {
  isContentStale,
  lessonContentHash,
  MOTION_LIMITS,
  parseAspect,
  parseFps,
  publishLessonMismatch,
  renderAllowed,
  nextCancelState,
} from './policy';
import { buildScenePreviewHtml, type PreviewScene } from './preview-html';
import { renderStoryboard } from './renderer';
import { editScene, removeScene, reorderScenes, StoryboardError } from './storyboard';
import { buildSubtitleTracks } from './subtitles';
import {
  cleanupWorkFiles,
  fileSize,
  projectFile,
  removeProjectDir,
  removeProjectFile,
  writeProjectAudio,
} from './storage';
import type {
  CreateMotionProjectDto,
  ProgressWriteDto,
  PublishMotionDto,
  SceneWriteDto,
  SubtitleWriteDto,
  UpdateMotionProjectDto,
  UpdateMotionSettingsDto,
} from './dto/motion.dto';

const projectInclude = {
  course: { include: { attachments: true } },
  lesson: { include: { chapter: true } },
  scenes: { orderBy: { sortOrder: 'asc' as const } },
  jobs: { orderBy: { createdAt: 'desc' as const }, take: 15 },
  subtitles: true,
  audio: { orderBy: { createdAt: 'desc' as const }, take: 3 },
  lessonVideo: true,
};

function findProject(prisma: PrismaService, id: string) {
  return prisma.motionVideoProject.findUnique({
    where: { id },
    include: projectInclude,
  });
}

type ProjectRecord = NonNullable<Awaited<ReturnType<typeof findProject>>>;

function asWarnings(value: unknown): MotionWarning[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { code?: unknown; message?: unknown };
    if (typeof row.code !== 'string' || typeof row.message !== 'string') return [];
    return [{ code: row.code, message: row.message }];
  });
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

@Injectable()
export class MotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async dashboard() {
    const grouped = await this.prisma.motionVideoProject.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const count = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0;
    const aiUsage = await this.prisma.motionAiUsageLog.count();
    return {
      produced: count('Completed') + count('Published'),
      inProgress: count('Analyzing') + count('Storyboarding') + count('Rendering') + count('Processing'),
      awaitingApproval: count('AwaitingApproval'),
      published: count('Published'),
      failed: count('Failed'),
      draft: count('Draft'),
      archived: count('Archived'),
      aiUsage,
    };
  }

  async settingsView() {
    const row = await this.ensureSettings();
    const ai = this.aiEnv();
    const tts = this.ttsEnv();
    return {
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      aiConfigured: motionAiConfigured(ai),
      aiProvider: motionAiConfigured(ai) ? 'openai-compatible' : 'deterministic',
      aiModel: motionAiConfigured(ai) ? ai.model : 'deterministic',
      ttsConfigured: ttsConfigured(tts),
      ttsStatus: ttsConfigured(tts) ? 'configured' : 'unconfigured',
    };
  }

  async updateSettings(dto: UpdateMotionSettingsDto) {
    await this.ensureSettings();
    await this.prisma.motionAiProviderSettings.update({
      where: { id: 'default' },
      data: {
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
      },
    });
    return this.settingsView();
  }

  async catalog() {
    const courses = await this.prisma.course.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        chapters: { orderBy: { sortOrder: 'asc' } },
        lessons: { orderBy: { sortOrder: 'asc' }, include: { chapter: true } },
        attachments: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      attachments: course.attachments.map((item) => ({
        id: item.id,
        title: item.title,
        fileName: item.fileName,
      })),
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        chapterTitle: lesson.chapter?.title ?? null,
      })),
    }));
  }

  async listProjects(lessonId?: string) {
    const rows = await this.prisma.motionVideoProject.findMany({
      where: lessonId ? { lessonId } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { lesson: true, course: true, lessonVideo: true },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      courseId: row.courseId,
      courseTitle: row.course.title,
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      stale: row.stale,
      videoVersion: row.videoVersion,
      contentVersion: row.contentVersion,
      published: Boolean(row.lessonVideo),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createProject(userId: string, dto: CreateMotionProjectDto) {
    const lesson = await this.loadLesson(dto.lessonId);
    const hash = lessonContentHash({
      title: lesson.title,
      content: lesson.content,
      contentEn: lesson.contentEn,
    });
    const created = await this.prisma.motionVideoProject.create({
      data: {
        courseId: lesson.courseId,
        lessonId: lesson.id,
        createdById: userId,
        title: lesson.title,
        contentHash: hash,
        sourceSnapshot: lesson.content,
        sourceSnapshotEn: lesson.contentEn ?? '',
        style: dto.style ?? 'kinetic',
        aspect: dto.aspect ?? '1920x1080',
        fps: dto.fps ?? 30,
        quality: dto.quality ?? 'standard',
        language: dto.language ?? 'fa',
        voiceId: dto.voiceId ?? '',
        targetDurationSec: dto.targetDurationSec ?? 90,
        sceneCountHint: dto.sceneCountHint ?? 0,
        autoRender: dto.autoRender ?? false,
        styleLocked: Boolean(dto.style),
        contextJson: this.contextFor(lesson),
        narrationAudioStatus: ttsConfigured(this.ttsEnv()) ? 'configured' : 'unconfigured',
      },
    });
    return this.getProject(created.id);
  }

  async getProject(id: string) {
    const project = await this.requireProject(id);
    const stale = await this.syncStale(project);
    return this.present({ ...project, stale });
  }

  async updateProject(id: string, dto: UpdateMotionProjectDto) {
    const project = await this.requireProject(id);
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: {
        ...(dto.style ? { style: dto.style, styleLocked: true } : {}),
        ...(dto.aspect ? { aspect: dto.aspect } : {}),
        ...(dto.fps ? { fps: dto.fps } : {}),
        ...(dto.quality ? { quality: dto.quality } : {}),
        ...(dto.language ? { language: dto.language } : {}),
        ...(dto.voiceId !== undefined ? { voiceId: dto.voiceId } : {}),
        ...(dto.targetDurationSec !== undefined ? { targetDurationSec: dto.targetDurationSec } : {}),
        ...(dto.sceneCountHint !== undefined ? { sceneCountHint: dto.sceneCountHint } : {}),
        ...(dto.autoRender !== undefined ? { autoRender: dto.autoRender } : {}),
      },
    });
    if (dto.position || dto.minWatchPercent !== undefined) {
      if (project.lessonVideo) {
        await this.prisma.motionLessonVideo.update({
          where: { id: project.lessonVideo.id },
          data: {
            ...(dto.position ? { position: dto.position } : {}),
            ...(dto.minWatchPercent !== undefined ? { minWatchPercent: dto.minWatchPercent } : {}),
          },
        });
      }
    }
    return this.getProject(id);
  }

  async queueAnalyze(id: string) {
    const project = await this.requireProject(id);
    if (project.status === 'Rendering' || project.status === 'Processing') {
      throw new ConflictException('رندر در حال اجراست.');
    }
    await this.prisma.motionJob.create({
      data: { projectId: id, kind: 'analyze', status: 'QUEUED' },
    });
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: { status: 'Analyzing' },
    });
    return this.getProject(id);
  }

  async queueRender(id: string) {
    const project = await this.requireProject(id);
    if (!renderAllowed(project)) {
      throw new BadRequestException('تا تأیید استوری‌بورد، رندر شروع نمی‌شود.');
    }
    if (project.status === 'Rendering' || project.status === 'Processing') {
      throw new ConflictException('یک رندر برای این پروژه در حال اجراست.');
    }
    if (!project.scenes.length) {
      throw new BadRequestException('صحنه‌ای برای رندر وجود ندارد.');
    }
    await this.prisma.motionJob.create({
      data: { projectId: id, kind: 'render', status: 'QUEUED' },
    });
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: { status: 'Rendering' },
    });
    return this.getProject(id);
  }

  async approve(id: string) {
    const project = await this.requireProject(id);
    if (!project.scenes.length) {
      throw new BadRequestException('اول استوری‌بورد را از متن درس بسازید.');
    }
    if (project.status === 'Rendering' || project.status === 'Processing') {
      throw new ConflictException('رندر در حال اجراست.');
    }
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: { approvedAt: new Date(), status: 'AwaitingApproval' },
    });
    if (project.autoRender) {
      return this.queueRender(id);
    }
    return this.getProject(id);
  }

  async publish(id: string, dto: PublishMotionDto) {
    const project = await this.requireProject(id);
    if (publishLessonMismatch(project.lessonId, dto.lessonId)) {
      throw new BadRequestException('این ویدیو فقط به همان درس پروژه وصل می‌شود.');
    }
    if (project.status !== 'Completed' && project.status !== 'Published') {
      throw new BadRequestException('فقط رندر تکمیل‌شده قابل انتشار است.');
    }
    const lesson = await this.loadLesson(project.lessonId);
    const hash = lessonContentHash({
      title: lesson.title,
      content: lesson.content,
      contentEn: lesson.contentEn,
    });
    if (isContentStale(project.contentHash, hash)) {
      await this.markStale(project.id, project.lessonId);
      throw new BadRequestException('متن درس بعد از ساخت استوری‌بورد عوض شده است. نسخهٔ جدید را تأیید کنید.');
    }
    const filename = `video-v${project.videoVersion}.mp4`;
    const absolute = projectFile(project.id, filename);
    try {
      if (fileSize(absolute) < 1024) throw new Error('small');
    } catch {
      throw new BadRequestException('فایل ویدیو پیدا نشد.');
    }
    const previous = await this.prisma.motionLessonVideo.findUnique({ where: { lessonId: project.lessonId } });
    if (previous && previous.projectId !== project.id) {
      await this.prisma.motionVideoProject.update({
        where: { id: previous.projectId },
        data: { status: 'Completed' },
      });
      await this.prisma.motionLessonVideo.delete({ where: { id: previous.id } });
    }
    await this.prisma.motionLessonVideo.upsert({
      where: { projectId_lessonId: { projectId: project.id, lessonId: project.lessonId } },
      create: {
        projectId: project.id,
        lessonId: project.lessonId,
        courseId: project.courseId,
        position: dto.position ?? 'BEFORE_BODY',
        videoFilename: filename,
        contentHash: project.contentHash,
        videoVersion: project.videoVersion,
        minWatchPercent: dto.minWatchPercent ?? null,
      },
      update: {
        position: dto.position ?? previous?.position ?? 'BEFORE_BODY',
        videoFilename: filename,
        contentHash: project.contentHash,
        videoVersion: project.videoVersion,
        stale: false,
        publishedAt: new Date(),
        ...(dto.minWatchPercent !== undefined ? { minWatchPercent: dto.minWatchPercent } : {}),
      },
    });
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: { status: 'Published', stale: false },
    });
    return this.getProject(id);
  }

  async unpublish(id: string) {
    const project = await this.requireProject(id);
    if (project.lessonVideo) {
      await this.prisma.motionLessonVideo.delete({ where: { id: project.lessonVideo.id } });
    }
    await this.prisma.motionVideoProject.update({
      where: { id },
      data: { status: project.status === 'Archived' ? 'Archived' : 'Completed' },
    });
    return this.getProject(id);
  }

  async archive(id: string) {
    await this.unpublish(id);
    await this.prisma.motionVideoProject.update({ where: { id }, data: { status: 'Archived' } });
    return this.getProject(id);
  }

  async remove(id: string) {
    await this.requireProject(id);
    removeProjectDir(id);
    await this.prisma.motionVideoProject.delete({ where: { id } });
    return { deleted: true };
  }

  async newVersion(id: string, userId: string) {
    const project = await this.requireProject(id);
    const lesson = await this.loadLesson(project.lessonId);
    const hash = lessonContentHash({
      title: lesson.title,
      content: lesson.content,
      contentEn: lesson.contentEn,
    });
    const created = await this.prisma.motionVideoProject.create({
      data: {
        courseId: project.courseId,
        lessonId: project.lessonId,
        createdById: userId,
        title: lesson.title,
        parentProjectId: project.id,
        contentHash: hash,
        contentVersion: project.contentVersion + 1,
        sourceSnapshot: lesson.content,
        sourceSnapshotEn: lesson.contentEn ?? '',
        style: project.style,
        styleLocked: project.styleLocked,
        aspect: project.aspect,
        fps: project.fps,
        quality: project.quality,
        language: project.language,
        voiceId: project.voiceId,
        targetDurationSec: project.targetDurationSec,
        sceneCountHint: project.sceneCountHint,
        autoRender: project.autoRender,
        contextJson: this.contextFor(lesson),
        narrationAudioStatus: ttsConfigured(this.ttsEnv()) ? 'configured' : 'unconfigured',
        scenes: {
          create: project.scenes.map((scene) => ({
            sortOrder: scene.sortOrder,
            title: scene.title,
            narration: scene.narration,
            narrationEn: scene.narrationEn,
            onScreenText: scene.onScreenText,
            durationSec: scene.durationSec,
            animationType: scene.animationType,
            code: scene.code,
            codeLanguage: scene.codeLanguage,
            codeSource: scene.codeSource,
            sourceStart: scene.sourceStart,
            sourceEnd: scene.sourceEnd,
            sourceAnchor: scene.sourceAnchor,
            warnings: scene.warnings ?? [],
          })),
        },
      },
    });
    return this.getProject(created.id);
  }

  async history(lessonId: string) {
    return this.listProjects(lessonId);
  }

  async reorder(id: string, orderedIds: string[]) {
    const project = await this.requireProject(id);
    let next;
    try {
      next = reorderScenes(project.scenes, orderedIds);
    } catch (error) {
      throw new BadRequestException(error instanceof StoryboardError ? error.code : 'ترتیب صحنه‌ها نامعتبر است.');
    }
    await this.prisma.$transaction(
      next.map((scene) =>
        this.prisma.motionScene.update({
          where: { id: scene.id },
          data: { sortOrder: scene.sortOrder },
        }),
      ),
    );
    await this.afterStoryboardEdit(id, project.status);
    return this.getProject(id);
  }

  async updateScene(id: string, sceneId: string, dto: SceneWriteDto) {
    const project = await this.requireProject(id);
    const patch: Partial<(typeof project.scenes)[number]> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.narration !== undefined) patch.narration = dto.narration;
    if (dto.narrationEn !== undefined) patch.narrationEn = dto.narrationEn;
    if (dto.onScreenText !== undefined) patch.onScreenText = dto.onScreenText;
    if (dto.durationSec !== undefined) patch.durationSec = dto.durationSec;
    if (dto.animationType !== undefined) patch.animationType = dto.animationType;
    if (dto.code !== undefined) patch.code = dto.code;
    if (dto.codeLanguage !== undefined) patch.codeLanguage = dto.codeLanguage;
    let next;
    try {
      next = editScene(project.scenes, sceneId, patch);
    } catch (error) {
      throw new BadRequestException(error instanceof StoryboardError ? 'صحنه پیدا نشد.' : 'ویرایش نامعتبر است.');
    }
    const scene = next.find((item) => item.id === sceneId);
    if (!scene) throw new NotFoundException('صحنه پیدا نشد.');
    await this.prisma.motionScene.update({
      where: { id: sceneId },
      data: {
        title: scene.title,
        narration: scene.narration,
        narrationEn: scene.narrationEn,
        onScreenText: scene.onScreenText,
        durationSec: scene.durationSec,
        animationType: scene.animationType,
        code: scene.code,
        codeLanguage: scene.codeLanguage,
        codeSource: scene.codeSource,
      },
    });
    await this.afterStoryboardEdit(id, project.status);
    return this.getProject(id);
  }

  async addScene(id: string) {
    const project = await this.requireProject(id);
    if (project.scenes.length >= MOTION_LIMITS.scenes) {
      throw new BadRequestException('تعداد صحنه‌ها به سقف رسیده است.');
    }
    await this.prisma.motionScene.create({
      data: {
        projectId: id,
        sortOrder: project.scenes.length,
        title: 'صحنهٔ جدید',
        narration: '',
        codeSource: 'instructor',
        sourceAnchor: 'manual',
      },
    });
    await this.afterStoryboardEdit(id, project.status);
    return this.getProject(id);
  }

  async deleteScene(id: string, sceneId: string) {
    const project = await this.requireProject(id);
    let next;
    try {
      next = removeScene(project.scenes, sceneId);
    } catch {
      throw new NotFoundException('صحنه پیدا نشد.');
    }
    await this.prisma.motionScene.delete({ where: { id: sceneId } });
    await this.prisma.$transaction(
      next.map((scene) =>
        this.prisma.motionScene.update({ where: { id: scene.id }, data: { sortOrder: scene.sortOrder } }),
      ),
    );
    await this.afterStoryboardEdit(id, project.status);
    return this.getProject(id);
  }

  preview(projectId: string, sceneId: string) {
    return this.requireProject(projectId).then((project) => {
      const scene = project.scenes.find((item) => item.id === sceneId);
      if (!scene) throw new NotFoundException('صحنه پیدا نشد.');
      const preview: PreviewScene = {
        title: scene.title,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        animationType: scene.animationType,
        code: scene.code,
        codeLanguage: scene.codeLanguage,
        codeSource: scene.codeSource,
        durationSec: scene.durationSec,
      };
      return { html: buildScenePreviewHtml(preview) };
    });
  }

  async saveAudio(projectId: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }) {
    await this.requireProject(projectId);
    const accepted = inspectMotionUpload(file);
    writeProjectAudio(projectId, accepted.filename, accepted.bytes);
    const previous = await this.prisma.motionAudio.findMany({ where: { projectId } });
    for (const row of previous) {
      removeProjectFile(projectId, row.filename);
    }
    await this.prisma.motionAudio.deleteMany({ where: { projectId } });
    await this.prisma.motionAudio.create({
      data: {
        projectId,
        mime: accepted.mime,
        filename: accepted.filename,
        storagePath: accepted.filename,
        sizeBytes: accepted.bytes.length,
      },
    });
    await this.prisma.motionVideoProject.update({
      where: { id: projectId },
      data: { narrationAudioStatus: 'uploaded' },
    });
    return this.getProject(projectId);
  }

  async saveSubtitle(projectId: string, dto: SubtitleWriteDto) {
    await this.requireProject(projectId);
    await this.prisma.motionSubtitle.upsert({
      where: {
        projectId_locale_format: {
          projectId,
          locale: dto.locale,
          format: dto.format,
        },
      },
      create: {
        projectId,
        locale: dto.locale,
        format: dto.format,
        body: dto.body,
        edited: true,
      },
      update: { body: dto.body, edited: true },
    });
    return this.getProject(projectId);
  }

  async queueCleanup(projectId: string) {
    const project = await this.requireProject(projectId);
    const keep = [
      project.lessonVideo?.videoFilename,
      ...project.audio.map((row) => row.filename),
      `video-v${project.videoVersion}.mp4`,
    ].filter((name): name is string => Boolean(name));
    cleanupWorkFiles(projectId, keep);
    return { cleaned: true };
  }

  async cancelJob(jobId: string) {
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('کار پیدا نشد.');
    const next = nextCancelState(job.status);
    await this.prisma.motionJob.update({
      where: { id: jobId },
      data: {
        cancelRequested: true,
        status: next.status === 'CANCELLED' ? 'CANCELLED' : job.status,
        finishedAt: next.status === 'CANCELLED' ? new Date() : undefined,
        errorLog: next.status === 'CANCELLED' ? 'لغو شد.' : job.errorLog,
      },
    });
    if (next.status === 'CANCELLED') {
      await this.prisma.motionVideoProject.updateMany({
        where: { id: job.projectId, status: { in: ['Analyzing', 'Rendering', 'Processing'] } },
        data: { status: 'AwaitingApproval' },
      });
    }
    return this.getProject(job.projectId);
  }

  async retryJob(jobId: string) {
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('کار پیدا نشد.');
    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') {
      throw new BadRequestException('فقط کار ناموفق یا لغوشده دوباره صف می‌شود.');
    }
    if (job.kind === 'render') {
      const project = await this.requireProject(job.projectId);
      if (!renderAllowed(project)) {
        throw new BadRequestException('تا تأیید استوری‌بورد، رندر شروع نمی‌شود.');
      }
    }
    await this.prisma.motionJob.create({
      data: { projectId: job.projectId, kind: job.kind, status: 'QUEUED' },
    });
    await this.prisma.motionVideoProject.update({
      where: { id: job.projectId },
      data: { status: job.kind === 'render' ? 'Rendering' : 'Analyzing' },
    });
    return this.getProject(job.projectId);
  }

  async runAnalyzeJob(jobId: string): Promise<void> {
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job || job.cancelRequested) {
      throw new Error('MOTION_CANCELLED');
    }
    const project = await this.requireProject(job.projectId);
    const lesson = await this.loadLesson(project.lessonId);
    const source = this.toSource(lesson);
    const settings = await this.ensureSettings();
    const analyzer = selectLessonAnalyzer(this.aiEnv());
    try {
      const analysis = await analyzer.analyze(source, {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        sceneCountHint: project.sceneCountHint,
        targetDurationSec: project.targetDurationSec,
      });
      const fresh = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
      if (!fresh || fresh.cancelRequested) throw new Error('MOTION_CANCELLED');
      const hash = lessonContentHash({
        title: lesson.title,
        content: lesson.content,
        contentEn: lesson.contentEn,
      });
      await this.prisma.motionScene.deleteMany({ where: { projectId: project.id } });
      if (analysis.scenes.length) {
        await this.prisma.motionScene.createMany({
          data: analysis.scenes.map((scene, index) => ({
            projectId: project.id,
            sortOrder: index,
            title: scene.title.slice(0, MOTION_LIMITS.title),
            narration: scene.narration.slice(0, MOTION_LIMITS.narration),
            narrationEn: scene.narrationEn.slice(0, MOTION_LIMITS.narration),
            onScreenText: scene.onScreenText.slice(0, MOTION_LIMITS.onScreen),
            durationSec: scene.durationSec,
            animationType: scene.animationType,
            code: scene.code.slice(0, MOTION_LIMITS.code),
            codeLanguage: scene.codeLanguage,
            codeSource: scene.codeSource,
            sourceStart: scene.sourceStart,
            sourceEnd: scene.sourceEnd,
            sourceAnchor: scene.sourceAnchor,
            warnings: scene.warnings as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      const context = this.contextFor(lesson) as Record<string, unknown>;
      context.suggestedStyle = analysis.suggestedStyle;
      await this.prisma.motionVideoProject.update({
        where: { id: project.id },
        data: {
          status: 'Storyboarding',
          approvedAt: null,
          contentHash: hash,
          sourceSnapshot: lesson.content,
          sourceSnapshotEn: lesson.contentEn ?? '',
          providerId: analysis.providerId,
          model: analysis.model,
          warnings: analysis.warnings as unknown as Prisma.InputJsonValue,
          concepts: analysis.concepts as unknown as Prisma.InputJsonValue,
          contextJson: context as Prisma.InputJsonValue,
          stale: false,
          style: project.styleLocked ? project.style : analysis.suggestedStyle,
          title: lesson.title,
        },
      });
      const stored = await this.prisma.motionScene.findMany({
        where: { projectId: project.id },
        orderBy: { sortOrder: 'asc' },
      });
      await this.writeGeneratedSubtitles(project.id, stored);
      await this.prisma.motionAiUsageLog.create({
        data: {
          provider: analysis.providerId,
          model: analysis.model,
          lessonId: lesson.id,
          projectId: project.id,
          tokens: analysis.tokens,
          status: 'ok',
        },
      });
      await this.prisma.motionJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', finishedAt: new Date() },
      });
      if (project.autoRender && analysis.scenes.length) {
        await this.prisma.motionVideoProject.update({
          where: { id: project.id },
          data: { approvedAt: new Date(), status: 'AwaitingApproval' },
        });
        await this.queueRender(project.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'analyze failed';
      if (message !== 'MOTION_CANCELLED') {
        await this.prisma.motionAiUsageLog.create({
          data: {
            provider: analyzer.providerId,
            model: analyzer.model,
            lessonId: lesson.id,
            projectId: project.id,
            tokens: 0,
            status: 'error',
            error: message.slice(0, 1000),
          },
        });
      }
      throw error;
    }
  }

  async runRenderJob(jobId: string, signal: AbortSignal): Promise<void> {
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job || job.cancelRequested || signal.aborted) throw new Error('MOTION_CANCELLED');
    const project = await this.requireProject(job.projectId);
    if (!renderAllowed(project)) {
      throw new Error('Storyboard is not approved');
    }
    const aspect = parseAspect(project.aspect);
    const fps = parseFps(project.fps);
    if (!aspect || !fps) throw new Error('Unsupported aspect or frame rate');
    const scenes = [...project.scenes].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!scenes.length) throw new Error('No scenes');
    let audioFilename = project.audio[0]?.filename ?? null;
    let audioStatus: string;
    if (!audioFilename) {
      const synthesized = await this.tryTts(project.id, project.voiceId, scenes);
      if (synthesized.filename) {
        audioFilename = synthesized.filename;
        audioStatus = 'mixed';
      } else if (synthesized.error) {
        audioStatus = 'error';
        await this.prisma.motionJob.update({
          where: { id: jobId },
          data: { errorLog: synthesized.error.slice(0, 1000) },
        });
      } else {
        audioStatus = 'unconfigured';
      }
    } else {
      audioStatus = 'mixed';
    }
    await this.prisma.motionVideoProject.update({
      where: { id: project.id },
      data: { status: audioFilename ? 'Processing' : 'Rendering', narrationAudioStatus: audioStatus },
    });
    const version = project.videoVersion + 1;
    const filename = `video-v${version}.mp4`;
    const rendered = await renderStoryboard({
      projectId: project.id,
      scenes: scenes.map((scene) => ({
        title: scene.title,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        animationType: scene.animationType,
        code: scene.code,
        codeLanguage: scene.codeLanguage,
        codeSource: scene.codeSource,
        durationSec: scene.durationSec,
      })),
      width: aspect.width,
      height: aspect.height,
      fps,
      crf: project.quality === 'high' ? 18 : 23,
      outputFilename: filename,
      audioFilename,
      signal,
    });
    await this.prisma.motionAsset.create({
      data: {
        projectId: project.id,
        kind: 'video',
        filename,
        mime: 'video/mp4',
        sizeBytes: rendered.bytes,
        storagePath: filename,
      },
    });
    await this.prisma.motionVersion.create({
      data: {
        projectId: project.id,
        contentVersion: project.contentVersion,
        videoVersion: version,
        contentHash: project.contentHash,
        providerId: project.providerId,
        model: project.model,
        style: project.style,
        status: 'Completed',
        videoPath: filename,
        note: audioFilename ? 'audio mixed' : 'silent',
      },
    });
    cleanupWorkFiles(project.id, [filename, ...(audioFilename ? [audioFilename] : [])]);
    await this.prisma.motionVideoProject.update({
      where: { id: project.id },
      data: { status: 'Completed', videoVersion: version, narrationAudioStatus: audioStatus },
    });
    await this.prisma.motionJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });
  }

  async runCleanupJob(jobId: string): Promise<void> {
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    await this.queueCleanup(job.projectId);
    await this.prisma.motionJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });
  }

  async failJob(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'motion job failed';
    const job = await this.prisma.motionJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'COMPLETED' || job.status === 'CANCELLED') return;
    const cancelled = message === 'MOTION_CANCELLED' || job.cancelRequested;
    await this.prisma.motionJob.update({
      where: { id: jobId },
      data: {
        status: cancelled ? 'CANCELLED' : 'FAILED',
        errorLog: message.slice(0, 4000),
        finishedAt: new Date(),
        cancelRequested: cancelled,
      },
    });
    await this.prisma.motionVideoProject.updateMany({
      where: { id: job.projectId, status: { in: ['Analyzing', 'Rendering', 'Processing', 'AwaitingApproval'] } },
      data: { status: cancelled ? 'AwaitingApproval' : 'Failed' },
    });
  }

  async publishedForLesson(userId: string, lessonId: string) {
    const video = await this.prisma.motionLessonVideo.findUnique({
      where: { lessonId },
      include: {
        project: { include: { scenes: { orderBy: { sortOrder: 'asc' } }, subtitles: true } },
        lesson: { include: { course: { include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } } } } } },
      },
    });
    if (!video) throw new NotFoundException('ویدیوی منتشرشده‌ای برای این درس نیست.');
    await this.assertLearnerCanRead(userId, video.lesson);
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException();
    const hash = lessonContentHash({ title: lesson.title, content: lesson.content, contentEn: lesson.contentEn });
    const stale = isContentStale(video.contentHash, hash);
    if (stale !== video.stale) {
      await this.prisma.motionLessonVideo.update({ where: { id: video.id }, data: { stale } });
      await this.prisma.motionVideoProject.update({ where: { id: video.projectId }, data: { stale } });
    }
    const progress = await this.prisma.motionVideoProgress.findUnique({
      where: { userId_projectId: { userId, projectId: video.projectId } },
    });
    let cursor = 0;
    const scenes = video.project.scenes.map((scene) => {
      const startSec = cursor;
      const endSec = cursor + scene.durationSec;
      cursor = endSec;
      return {
        id: scene.id,
        title: scene.title,
        startSec,
        endSec,
        sourceStart: scene.sourceStart,
        sourceEnd: scene.sourceEnd,
        narration: scene.narration,
      };
    });
    return {
      projectId: video.projectId,
      lessonId: video.lessonId,
      position: video.position,
      videoUrl: this.sign(userId, video.projectId, video.videoFilename),
      stale,
      videoVersion: video.videoVersion,
      contentVersion: video.project.contentVersion,
      minWatchPercent: video.minWatchPercent,
      narrationAudioAttached: video.project.narrationAudioStatus === 'mixed',
      narrationAudioStatus: video.project.narrationAudioStatus,
      scenes,
      subtitles: video.project.subtitles
        .filter((row) => row.format === 'vtt')
        .map((row) => ({ locale: row.locale, vtt: row.body })),
      progress: progress
        ? {
            lastTimeSec: progress.lastTimeSec,
            percent: progress.percent,
            completed: progress.completed,
            viewCount: progress.viewCount,
            lastViewedAt: progress.lastViewedAt.toISOString(),
          }
        : null,
    };
  }

  async saveProgress(userId: string, dto: ProgressWriteDto & { lessonId: string }) {
    const video = await this.prisma.motionLessonVideo.findUnique({ where: { lessonId: dto.lessonId } });
    if (!video) throw new NotFoundException('ویدیوی منتشرشده‌ای برای این درس نیست.');
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      include: { course: { include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } } } } },
    });
    if (!lesson) throw new NotFoundException();
    await this.assertLearnerCanRead(userId, lesson);
    const duration = dto.durationSec && dto.durationSec > 0 ? dto.durationSec : 0;
    const percent = duration ? Math.max(0, Math.min(100, (dto.lastTimeSec / duration) * 100)) : 0;
    const existing = await this.prisma.motionVideoProgress.findUnique({
      where: { userId_projectId: { userId, projectId: video.projectId } },
    });
    let completed = existing?.completed ?? false;
    if (video.minWatchPercent == null) {
      if (dto.ended) completed = true;
    } else if (percent >= video.minWatchPercent) {
      completed = true;
    }
    const saved = await this.prisma.motionVideoProgress.upsert({
      where: { userId_projectId: { userId, projectId: video.projectId } },
      create: {
        userId,
        projectId: video.projectId,
        lessonId: video.lessonId,
        lastTimeSec: dto.lastTimeSec,
        percent,
        completed,
        viewCount: dto.viewStart ? 1 : 0,
        lastViewedAt: new Date(),
      },
      update: {
        lastTimeSec: dto.lastTimeSec,
        percent,
        completed,
        lastViewedAt: new Date(),
        ...(dto.viewStart ? { viewCount: { increment: 1 } } : {}),
      },
    });
    return {
      lastTimeSec: saved.lastTimeSec,
      percent: saved.percent,
      completed: saved.completed,
      viewCount: saved.viewCount,
      lastViewedAt: saved.lastViewedAt.toISOString(),
    };
  }

  async resolveMediaPath(userId: string, projectId: string, filename: string): Promise<string> {
    const video = await this.prisma.motionLessonVideo.findFirst({
      where: { projectId, videoFilename: filename },
      include: { lesson: { include: { course: { include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } } } } } } },
    });
    if (!video) throw new NotFoundException('ویدیو پیدا نشد.');
    await this.assertLearnerCanRead(userId, video.lesson);
    return projectFile(projectId, filename);
  }

  verifyMediaToken(token: string, projectId: string, filename: string): string {
    let payload: { sub?: string; projectId?: string; filename?: string; type?: string };
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new ForbiddenException('نشست ویدیو نامعتبر است.');
    }
    if (payload.type !== 'motion-video' || payload.projectId !== projectId || payload.filename !== filename || !payload.sub) {
      throw new ForbiddenException('نشست ویدیو نامعتبر است.');
    }
    return payload.sub;
  }

  private sign(userId: string, projectId: string, filename: string): string {
    const token = this.jwt.sign(
      { sub: userId, projectId, filename, type: 'motion-video' },
      { expiresIn: '2h' },
    );
    return `/api/academy/motion/media/${projectId}/${filename}?token=${encodeURIComponent(token)}`;
  }

  private async assertLearnerCanRead(
    userId: string,
    lesson: {
      id: string;
      comingSoon: boolean;
      course: { published: boolean; comingSoon: boolean; slug: string; lessons: { id: string }[] };
    },
  ) {
    if (!lesson.course.published || lesson.comingSoon || lesson.course.comingSoon) {
      throw new ForbiddenException('این درس در دسترس نیست.');
    }
    const index = lesson.course.lessons.findIndex((item) => item.id === lesson.id);
    if (index < 0) throw new NotFoundException();
    if (isFreePreviewLessonIndex(index)) return;
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { userId, resourceType: 'course', resourceId: lesson.course.slug },
    });
    if (!entitlement) throw new ForbiddenException('برای دیدن این درس باید دوره را داشته باشید.');
  }

  private async tryTts(
    projectId: string,
    voiceId: string,
    scenes: { narration: string }[],
  ): Promise<{ filename: string | null; error: string | null }> {
    const env = this.ttsEnv();
    if (!ttsConfigured(env) || !env.baseUrl || !env.apiKey || !env.model) {
      return { filename: null, error: null };
    }
    const text = scenes.map((scene) => scene.narration.trim()).filter(Boolean).join('\n').slice(0, 4000);
    if (!text) return { filename: null, error: null };
    try {
      const response = await fetch(`${env.baseUrl.replace(/\/$/, '')}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: env.model,
          voice: voiceId || 'alloy',
          input: text,
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        return { filename: null, error: `TTS HTTP ${response.status}: ${detail}` };
      }
      const downloaded = Buffer.from(await response.arrayBuffer());
      const accepted = inspectMotionTts(downloaded);
      if (!accepted) return { filename: null, error: 'TTS response was not a recognized audio file' };
      writeProjectAudio(projectId, accepted.filename, accepted.bytes);
      await this.prisma.motionAudio.create({
        data: {
          projectId,
          mime: accepted.mime,
          filename: accepted.filename,
          storagePath: accepted.filename,
          sizeBytes: accepted.bytes.length,
        },
      });
      return { filename: accepted.filename, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TTS failed';
      return { filename: null, error: message };
    }
  }

  private async afterStoryboardEdit(projectId: string, status: string) {
    const scenes = await this.prisma.motionScene.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    await this.writeGeneratedSubtitles(projectId, scenes);
    if (status === 'Published') {
      await this.prisma.motionVideoProject.update({
        where: { id: projectId },
        data: { approvedAt: null },
      });
      return;
    }
    await this.prisma.motionVideoProject.update({
      where: { id: projectId },
      data: { approvedAt: null, status: 'Storyboarding' },
    });
  }

  private async writeGeneratedSubtitles(
    projectId: string,
    scenes: { durationSec: number; narration: string; narrationEn: string }[],
  ) {
    const tracks = buildSubtitleTracks(scenes);
    const rows = [
      { locale: 'fa', format: 'vtt', body: tracks.faVtt },
      { locale: 'en', format: 'vtt', body: tracks.enVtt },
      { locale: 'fa', format: 'srt', body: tracks.faSrt },
      { locale: 'en', format: 'srt', body: tracks.enSrt },
    ];
    for (const row of rows) {
      const existing = await this.prisma.motionSubtitle.findUnique({
        where: { projectId_locale_format: { projectId, locale: row.locale, format: row.format } },
      });
      if (existing?.edited) continue;
      await this.prisma.motionSubtitle.upsert({
        where: { projectId_locale_format: { projectId, locale: row.locale, format: row.format } },
        create: { projectId, locale: row.locale, format: row.format, body: row.body, edited: false },
        update: { body: row.body },
      });
    }
  }

  private async syncStale(project: ProjectRecord): Promise<boolean> {
    const hash = lessonContentHash({
      title: project.lesson.title,
      content: project.lesson.content,
      contentEn: project.lesson.contentEn,
    });
    const stale = project.contentHash !== hash;
    if (stale !== project.stale) {
      await this.markStale(project.id, project.lessonId, stale);
    }
    return stale;
  }

  private async markStale(projectId: string, lessonId: string, stale = true) {
    await this.prisma.motionVideoProject.update({ where: { id: projectId }, data: { stale } });
    await this.prisma.motionLessonVideo.updateMany({ where: { lessonId, projectId }, data: { stale } });
  }

  private present(project: ProjectRecord) {
    const context = (project.contextJson ?? {}) as {
      courseTitle?: string;
      courseDescription?: string;
      chapterTitle?: string | null;
      attachments?: { title: string; fileName?: string }[];
      suggestedStyle?: string;
    };
    return {
      id: project.id,
      courseId: project.courseId,
      lessonId: project.lessonId,
      courseTitle: project.course.title,
      courseDescription: project.course.description,
      lessonTitle: project.lesson.title,
      chapterTitle: project.lesson.chapter?.title ?? null,
      title: project.title,
      status: project.status,
      style: project.style,
      styleLocked: project.styleLocked,
      suggestedStyle: context.suggestedStyle ?? project.style,
      aspect: project.aspect,
      fps: project.fps,
      quality: project.quality,
      language: project.language,
      voiceId: project.voiceId,
      targetDurationSec: project.targetDurationSec,
      sceneCountHint: project.sceneCountHint,
      autoRender: project.autoRender,
      contentHash: project.contentHash,
      contentVersion: project.contentVersion,
      videoVersion: project.videoVersion,
      providerId: project.providerId,
      model: project.model,
      warnings: asWarnings(project.warnings),
      concepts: asStrings(project.concepts),
      stale: project.stale,
      approvedAt: project.approvedAt?.toISOString() ?? null,
      narrationAudioStatus: project.narrationAudioStatus,
      position: project.lessonVideo?.position ?? 'BEFORE_BODY',
      minWatchPercent: project.lessonVideo?.minWatchPercent ?? null,
      published: Boolean(project.lessonVideo),
      videoFilename: project.lessonVideo?.videoFilename ?? (project.videoVersion > 0 ? `video-v${project.videoVersion}.mp4` : null),
      attachments: project.course.attachments.map((item) => ({ title: item.title, fileName: item.fileName })),
      scenes: project.scenes
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((scene) => ({
          id: scene.id,
          sortOrder: scene.sortOrder,
          title: scene.title,
          narration: scene.narration,
          narrationEn: scene.narrationEn,
          onScreenText: scene.onScreenText,
          durationSec: scene.durationSec,
          animationType: scene.animationType,
          code: scene.code,
          codeLanguage: scene.codeLanguage,
          codeSource: scene.codeSource,
          sourceStart: scene.sourceStart,
          sourceEnd: scene.sourceEnd,
          sourceAnchor: scene.sourceAnchor,
        })),
      jobs: project.jobs.map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        cancelRequested: job.cancelRequested,
        errorLog: job.errorLog,
        attempts: job.attempts,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
      })),
      subtitles: project.subtitles.map((row) => ({
        locale: row.locale,
        format: row.format,
        body: row.body,
        edited: row.edited,
      })),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private contextFor(lesson: {
    course: { title: string; description: string; attachments: { title: string; fileName: string }[] };
    chapter: { title: string } | null;
  }) {
    return {
      courseTitle: lesson.course.title,
      courseDescription: lesson.course.description,
      chapterTitle: lesson.chapter?.title ?? null,
      attachments: lesson.course.attachments.map((item) => ({ title: item.title, fileName: item.fileName })),
    };
  }

  private toSource(lesson: {
    title: string;
    content: string;
    contentEn: string | null;
    chapter: { title: string } | null;
    course: { title: string; description: string; attachments: { title: string; fileName: string }[] };
  }): LessonSource {
    return {
      title: lesson.title,
      content: lesson.content,
      contentEn: lesson.contentEn,
      courseTitle: lesson.course.title,
      courseDescription: lesson.course.description,
      chapterTitle: lesson.chapter?.title ?? null,
      attachments: lesson.course.attachments.map((item) => ({ title: item.title, fileName: item.fileName })),
    };
  }

  private async loadLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: true,
        course: { include: { attachments: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!lesson) throw new NotFoundException('درس پیدا نشد.');
    return lesson;
  }

  private async requireProject(id: string): Promise<ProjectRecord> {
    const project = await findProject(this.prisma, id);
    if (!project) throw new NotFoundException('پروژه پیدا نشد.');
    return project;
  }

  private async ensureSettings() {
    return this.prisma.motionAiProviderSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  private aiEnv() {
    return {
      baseUrl: this.config.get<string>('MOTION_AI_BASE_URL'),
      apiKey: this.config.get<string>('MOTION_AI_API_KEY'),
      model: this.config.get<string>('MOTION_AI_MODEL'),
    };
  }

  private ttsEnv() {
    return {
      baseUrl: this.config.get<string>('MOTION_TTS_BASE_URL'),
      apiKey: this.config.get<string>('MOTION_TTS_API_KEY'),
      model: this.config.get<string>('MOTION_TTS_MODEL'),
    };
  }
}
