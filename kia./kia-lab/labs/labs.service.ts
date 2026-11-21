import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { containsUnsafeText } from '@kia./shared';
import { assertDepartmentEnabled, EventBusService, PrismaService } from '@kia./platform';

function clean(value: string, max: number): string {
  const text = value.trim();
  if (!text || text.length > max || containsUnsafeText(text)) {
    throw new BadRequestException('Invalid text');
  }
  return text;
}

@Injectable()
export class LabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'labs');
  }

  async list(userId?: string) {
    await this.gate();
    return this.prisma.labProject.findMany({
      where: userId
        ? { OR: [{ visibility: 'public' }, { leadId: userId }, { members: { some: { userId } } }] }
        : { visibility: 'public' },
      orderBy: { updatedAt: 'desc' },
      include: { members: true, phases: true },
    });
  }

  async create(leadId: string, input: { title: string; problem: string; method: string; schedule?: string }) {
    await this.gate();
    return this.prisma.labProject.create({
      data: {
        leadId,
        title: clean(input.title, 160),
        problem: clean(input.problem, 4000),
        method: clean(input.method, 4000),
        schedule: input.schedule ? clean(input.schedule, 500) : '',
        members: { create: { userId: leadId, role: 'lead' } },
      },
    });
  }

  private async assertMember(projectId: string, userId: string, leadOnly = false) {
    const project = await this.prisma.labProject.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const member = project.members.some((m) => m.userId === userId);
    if (leadOnly && project.leadId !== userId) throw new ForbiddenException('Insufficient permissions');
    if (!member && project.leadId !== userId) throw new ForbiddenException('Insufficient permissions');
    return project;
  }

  async addMember(actorId: string, projectId: string, userId: string, role = 'member') {
    await this.gate();
    await this.assertMember(projectId, actorId, true);
    return this.prisma.labMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role: role.slice(0, 40) },
      update: { role: role.slice(0, 40) },
    });
  }

  async addPhase(actorId: string, projectId: string, title: string) {
    await this.gate();
    await this.assertMember(projectId, actorId, true);
    return this.prisma.labPhase.create({ data: { projectId, title: clean(title, 160) } });
  }

  async addExperiment(actorId: string, projectId: string, input: { hypothesis: string; results?: string; report?: string }) {
    await this.gate();
    await this.assertMember(projectId, actorId);
    const latest = await this.prisma.labExperiment.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    return this.prisma.labExperiment.create({
      data: {
        projectId,
        hypothesis: clean(input.hypothesis, 4000),
        results: input.results ? clean(input.results, 8000) : '',
        report: input.report ? clean(input.report, 8000) : '',
        version: (latest?.version ?? 0) + 1,
        createdById: actorId,
      },
    });
  }

  async addTask(actorId: string, projectId: string, title: string, assigneeId?: string) {
    await this.gate();
    await this.assertMember(projectId, actorId);
    return this.prisma.labTask.create({
      data: { projectId, title: clean(title, 160), assigneeId: assigneeId || null },
    });
  }

  async setTask(actorId: string, taskId: string, status: string) {
    await this.gate();
    const task = await this.prisma.labTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertMember(task.projectId, actorId);
    if (!['todo', 'doing', 'done'].includes(status)) throw new BadRequestException('Invalid status');
    return this.prisma.labTask.update({ where: { id: taskId }, data: { status } });
  }

  async addReport(actorId: string, projectId: string, body: string) {
    await this.gate();
    await this.assertMember(projectId, actorId);
    return this.prisma.labReport.create({ data: { projectId, authorId: actorId, body: clean(body, 8000) } });
  }

  async setVisibility(actorId: string, projectId: string, visibility: 'public' | 'private') {
    await this.gate();
    await this.assertMember(projectId, actorId, true);
    return this.prisma.labProject.update({ where: { id: projectId }, data: { visibility } });
  }

  async submitIdea(authorId: string, input: { title: string; body: string }) {
    await this.gate();
    return this.prisma.labIdea.create({
      data: { authorId, title: clean(input.title, 160), body: clean(input.body, 4000) },
    });
  }

  async listIdeas() {
    await this.gate();
    return this.prisma.labIdea.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async scoreIdea(actorId: string, role: string, ideaId: string, score: number) {
    await this.gate();
    if (role !== 'SUPER_ADMIN' && !(await this.hasRole(actorId, ['LABS_ADMIN', 'RESEARCHER']))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.prisma.labIdea.update({
      where: { id: ideaId },
      data: { score: Math.max(0, Math.min(100, Math.floor(score))), status: 'scored' },
    });
  }

  async convertIdea(actorId: string, role: string, ideaId: string) {
    await this.gate();
    const idea = await this.prisma.labIdea.findUnique({ where: { id: ideaId } });
    if (!idea) throw new NotFoundException('Idea not found');
    if (role !== 'SUPER_ADMIN' && !(await this.hasRole(actorId, ['LABS_ADMIN']))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const project = await this.prisma.labProject.create({
      data: {
        leadId: actorId,
        title: idea.title,
        problem: idea.body,
        method: 'Converted from idea',
        members: { create: { userId: actorId, role: 'lead' } },
      },
    });
    await this.prisma.labIdea.update({
      where: { id: ideaId },
      data: { status: 'converted', projectId: project.id },
    });
    return project;
  }

  /** Shell calls this only after it has created the community post. */
  async markPublished(projectId: string, actorId: string, postId: string) {
    await this.gate();
    await this.assertMember(projectId, actorId, true);
    await this.events.publish({
      name: 'labs.result.published',
      occurredAt: new Date().toISOString(),
      userId: actorId,
      projectId,
      postId,
      dedupeKey: `lab-publish:${projectId}`,
    });
    return { published: true };
  }

  private async hasRole(userId: string, roles: string[]) {
    const row = await this.prisma.departmentMembership.findFirst({
      where: { userId, department: 'labs', role: { in: roles } },
      select: { id: true },
    });
    return Boolean(row);
  }
}
