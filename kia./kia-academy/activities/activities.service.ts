import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  gradeActivity,
  isActivityKind,
  publicActivityPayload,
  type ActivityKind,
} from '@kia./shared';
import { assertDepartmentEnabled, describeConference, EventBusService, PrismaService } from '@kia./platform';

@Injectable()
export class AcademyActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'academy');
  }

  async list(courseId?: string) {
    await this.gate();
    return this.prisma.learningActivity.findMany({
      where: { published: true, ...(courseId ? { courseId } : {}) },
      select: { id: true, title: true, kind: true, courseId: true, lessonId: true, timeLimitSec: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(authorRole: string, input: { title: string; kind: string; payload: unknown; courseId?: string; lessonId?: string; timeLimitSec?: number }) {
    await this.gate();
    if (authorRole !== 'SUPER_ADMIN' && authorRole !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (!isActivityKind(input.kind)) throw new BadRequestException('Invalid activity');
    return this.prisma.learningActivity.create({
      data: {
        title: input.title.slice(0, 160),
        kind: input.kind,
        payload: input.payload as object,
        courseId: input.courseId || null,
        lessonId: input.lessonId || null,
        timeLimitSec: Math.max(0, Math.floor(input.timeLimitSec ?? 0)),
      },
      select: { id: true, title: true, kind: true, timeLimitSec: true },
    });
  }

  async open(userId: string, id: string) {
    await this.gate();
    const activity = await this.prisma.learningActivity.findFirst({ where: { id, published: true } });
    if (!activity || !isActivityKind(activity.kind)) throw new NotFoundException('Activity not found');
    const openedAt = Date.now();
    const body = `${activity.id}.${userId}.${openedAt}`;
    const sig = createHmac('sha256', this.secret()).update(body).digest('hex');
    return {
      id: activity.id,
      title: activity.title,
      kind: activity.kind,
      timeLimitSec: activity.timeLimitSec,
      payload: publicActivityPayload(activity.kind as ActivityKind, activity.payload),
      token: `${body}.${sig}`,
    };
  }

  async submit(userId: string, id: string, token: string, submission: unknown) {
    await this.gate();
    const activity = await this.prisma.learningActivity.findFirst({ where: { id, published: true } });
    if (!activity || !isActivityKind(activity.kind)) throw new NotFoundException('Activity not found');
    const elapsedSec = this.elapsed(token, activity.id, userId);
    const grade = gradeActivity(activity.kind as ActivityKind, activity.payload, submission, {
      timeLimitSec: activity.timeLimitSec,
      elapsedSec,
    });
    const attempt = await this.prisma.learningActivityAttempt.create({
      data: {
        activityId: id,
        userId,
        score: grade.score,
        maxScore: grade.maxScore,
        correct: grade.correct,
        wrong: grade.wrong,
        elapsedSec,
      },
    });
    return { ...grade, attemptId: attempt.id };
  }

  async claimCertificate(userId: string, courseId: string) {
    await this.gate();
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing;
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrollment) throw new ForbiddenException('Not enrolled');
    const lessons = await this.prisma.lesson.findMany({ where: { courseId }, select: { id: true } });
    if (lessons.length === 0) throw new BadRequestException('Course has no lessons');
    const done = await this.prisma.lessonProgress.count({
      where: { userId, completed: true, lessonId: { in: lessons.map((l) => l.id) } },
    });
    if (done < lessons.length) throw new BadRequestException('Course is not complete');
    const certificate = await this.prisma.certificate.create({
      data: { userId, courseId, code: randomBytes(8).toString('hex') },
    });
    await this.events.publish({
      name: 'academy.certificate.issued',
      occurredAt: new Date().toISOString(),
      userId,
      courseId,
      certificateId: certificate.id,
      dedupeKey: `certificate:${userId}:${courseId}`,
    });
    return certificate;
  }

  async myCertificates(userId: string) {
    await this.gate();
    return this.prisma.certificate.findMany({
      where: { userId },
      include: { course: { select: { slug: true, title: true } } },
    });
  }

  async createSession(actorId: string, role: string, input: { courseId: string; title: string; startsAt: string; endsAt?: string; joinUrl?: string }) {
    await this.gate();
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && !(await this.hasRole(actorId, 'INSTRUCTOR'))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const link = describeConference(input.joinUrl ?? null);
    return this.prisma.classSession.create({
      data: {
        courseId: input.courseId,
        title: input.title.slice(0, 160),
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        joinUrl: link.joinUrl,
        provider: link.provider,
        createdById: actorId,
      },
    });
  }

  async listSessions(courseId: string) {
    await this.gate();
    if (!courseId) throw new BadRequestException('courseId is required');
    const rows = await this.prisma.classSession.findMany({
      where: { courseId },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { attendance: true } } },
    });
    return rows.map((row) => ({ ...row, conference: describeConference(row.joinUrl) }));
  }

  async attend(userId: string, sessionId: string) {
    await this.gate();
    const session = await this.prisma.classSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId, courseId: session.courseId } });
    if (!enrollment) throw new ForbiddenException('Not enrolled');
    await this.prisma.classAttendance.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId },
      update: {},
    });
    return { attendance: true, conference: describeConference(session.joinUrl) };
  }

  private elapsed(token: string, activityId: string, userId: string): number {
    const parts = token.split('.');
    if (parts.length !== 4) throw new BadRequestException('Invalid activity token');
    const [id, uid, openedRaw, sig] = parts;
    if (id !== activityId || uid !== userId) throw new BadRequestException('Invalid activity token');
    const body = `${id}.${uid}.${openedRaw}`;
    const expected = createHmac('sha256', this.secret()).update(body).digest('hex');
    const a = Buffer.from(sig ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Invalid activity token');
    const openedAt = Number(openedRaw);
    if (!Number.isFinite(openedAt)) throw new BadRequestException('Invalid activity token');
    return Math.max(0, Math.floor((Date.now() - openedAt) / 1000));
  }

  private secret(): string {
    return process.env.JWT_SECRET || 'activity';
  }

  private async hasRole(userId: string, role: string) {
    const row = await this.prisma.departmentMembership.findFirst({
      where: { userId, department: 'academy', role },
      select: { id: true },
    });
    return Boolean(row);
  }
}
