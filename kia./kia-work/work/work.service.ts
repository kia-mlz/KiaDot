import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { containsUnsafeText } from '@kia./shared';
import { assertDepartmentEnabled, PrismaService } from '@kia./platform';

const APPLICATION_STATUSES = ['applied', 'reviewing', 'interview', 'rejected', 'hired'] as const;

function clean(value: string, max: number, required = true): string {
  const text = value.trim();
  if (!text) {
    if (required) throw new BadRequestException('Invalid text');
    return '';
  }
  if (text.length > max || containsUnsafeText(text)) {
    throw new BadRequestException('Invalid text');
  }
  return text;
}

@Injectable()
export class WorkService {
  constructor(private readonly prisma: PrismaService) {}

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'work');
  }

  async listJobs(category?: string) {
    await this.gate();
    return this.prisma.jobPost.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
  }

  async createJob(ownerId: string, input: { title: string; category: string; description: string; location?: string }) {
    await this.gate();
    return this.prisma.jobPost.create({
      data: {
        ownerId,
        title: clean(input.title, 140),
        category: clean(input.category, 60),
        description: clean(input.description, 4000),
        location: input.location ? clean(input.location, 120) : '',
      },
    });
  }

  async apply(userId: string, jobId: string, cover?: string) {
    await this.gate();
    const job = await this.prisma.jobPost.findFirst({ where: { id: jobId, published: true } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.ownerId === userId) throw new BadRequestException('You cannot apply to your own job');
    try {
      return await this.prisma.jobApplication.create({
        data: { jobId, userId, cover: cover ? clean(cover, 2000) : '' },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Already applied');
      }
      throw error;
    }
  }

  async updateApplication(actorId: string, role: string, applicationId: string, status: string) {
    await this.gate();
    if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    const allowed =
      role === 'SUPER_ADMIN' ||
      application.job.ownerId === actorId ||
      (await this.hasRole(actorId, 'WORK_ADMIN'));
    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return this.prisma.jobApplication.update({ where: { id: applicationId }, data: { status } });
  }

  async myProfile(userId: string) {
    await this.gate();
    const [profile, skills] = await Promise.all([
      this.prisma.specialistProfile.findUnique({ where: { userId }, include: { reviews: true } }),
      this.prisma.userSkill.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    ]);
    return { profile, skills };
  }

  async upsertProfile(
    userId: string,
    input: {
      headline?: string;
      bio?: string;
      services?: string;
      experience?: string;
      portfolio?: string;
      resumeUrl?: string;
      rateIrr?: number;
      published?: boolean;
    },
  ) {
    await this.gate();
    const data = {
      headline: typeof input.headline === 'string' ? clean(input.headline, 140, false) : undefined,
      bio: typeof input.bio === 'string' ? clean(input.bio, 4000, false) : undefined,
      services: typeof input.services === 'string' ? clean(input.services, 2000, false) : undefined,
      experience: typeof input.experience === 'string' ? clean(input.experience, 4000, false) : undefined,
      portfolio: typeof input.portfolio === 'string' ? clean(input.portfolio, 4000, false) : undefined,
      resumeUrl: typeof input.resumeUrl === 'string' ? input.resumeUrl.slice(0, 500) : undefined,
      rateIrr: typeof input.rateIrr === 'number' ? Math.max(0, Math.floor(input.rateIrr)) : undefined,
      published: typeof input.published === 'boolean' ? input.published : undefined,
    };
    return this.prisma.specialistProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async setSkills(userId: string, skills: string[]) {
    await this.gate();
    const names = [...new Set(skills.map((s) => clean(s, 40)))].slice(0, 30);
    await this.prisma.$transaction([
      this.prisma.userSkill.deleteMany({ where: { userId } }),
      ...names.map((name) => this.prisma.userSkill.create({ data: { userId, name } })),
    ]);
    return this.prisma.userSkill.findMany({ where: { userId } });
  }

  async publicProfile(userId: string) {
    await this.gate();
    const profile = await this.prisma.specialistProfile.findFirst({
      where: { userId, published: true },
      include: { reviews: true, user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const skills = await this.prisma.userSkill.findMany({ where: { userId } });
    return { profile, skills };
  }

  async listProjects() {
    await this.gate();
    return this.prisma.freelanceProject.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(ownerId: string, input: { title: string; brief: string; budgetIrr: number; deadline?: string }) {
    await this.gate();
    return this.prisma.freelanceProject.create({
      data: {
        ownerId,
        title: clean(input.title, 140),
        brief: clean(input.brief, 4000),
        budgetIrr: Math.max(0, Math.floor(input.budgetIrr)),
        deadline: input.deadline ? new Date(input.deadline) : null,
      },
    });
  }

  async propose(userId: string, projectId: string, input: { pitch: string; amountIrr: number }) {
    await this.gate();
    const project = await this.prisma.freelanceProject.findFirst({ where: { id: projectId, status: 'open' } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) throw new BadRequestException('You cannot propose on your own project');
    try {
      return await this.prisma.freelanceProposal.create({
        data: {
          projectId,
          userId,
          pitch: clean(input.pitch, 4000),
          amountIrr: Math.max(0, Math.floor(input.amountIrr)),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Already proposed');
      throw error;
    }
  }

  async hire(ownerId: string, projectId: string, proposalId: string) {
    await this.gate();
    const project = await this.prisma.freelanceProject.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== ownerId) throw new ForbiddenException('Insufficient permissions');
    const proposal = await this.prisma.freelanceProposal.findFirst({ where: { id: proposalId, projectId } });
    if (!proposal) throw new NotFoundException('Proposal not found');
    await this.prisma.$transaction([
      this.prisma.freelanceProposal.update({ where: { id: proposalId }, data: { status: 'hired' } }),
      this.prisma.freelanceProject.update({
        where: { id: projectId },
        data: { status: 'hired', hireUserId: proposal.userId },
      }),
    ]);
    return { hired: true, userId: proposal.userId };
  }

  async addMilestone(ownerId: string, projectId: string, input: { title: string; amountIrr: number }) {
    await this.gate();
    const project = await this.prisma.freelanceProject.findUnique({ where: { id: projectId } });
    if (!project || project.ownerId !== ownerId) throw new ForbiddenException('Insufficient permissions');
    return this.prisma.freelanceMilestone.create({
      data: {
        projectId,
        title: clean(input.title, 140),
        amountIrr: Math.max(0, Math.floor(input.amountIrr)),
      },
    });
  }

  async setMilestone(actorId: string, milestoneId: string, status: 'delivered' | 'accepted' | 'revision') {
    await this.gate();
    const milestone = await this.prisma.freelanceMilestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const owner = milestone.project.ownerId === actorId;
    const hire = milestone.project.hireUserId === actorId;
    if (status === 'delivered' && !hire) throw new ForbiddenException('Insufficient permissions');
    if ((status === 'accepted' || status === 'revision') && !owner) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const updated = await this.prisma.freelanceMilestone.update({ where: { id: milestoneId }, data: { status } });
    if (status === 'accepted') {
      const open = await this.prisma.freelanceMilestone.count({
        where: { projectId: milestone.projectId, status: { not: 'accepted' } },
      });
      if (open === 0) {
        await this.prisma.freelanceProject.update({
          where: { id: milestone.projectId },
          data: { status: 'accepted' },
        });
      }
    }
    if (status === 'delivered') {
      await this.prisma.freelanceProject.update({
        where: { id: milestone.projectId },
        data: { status: 'delivered' },
      });
    }
    return updated;
  }

  async invoiceMilestone(actorId: string, milestoneId: string) {
    await this.gate();
    const milestone = await this.prisma.freelanceMilestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.project.ownerId !== actorId && milestone.project.hireUserId !== actorId) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.prisma.departmentInvoice.create({
      data: {
        userId: milestone.project.ownerId,
        department: 'work',
        resourceType: 'freelance-milestone',
        resourceId: milestone.id,
        title: milestone.title,
        amountIrr: milestone.amountIrr,
        status: 'pending',
      },
    });
  }

  async review(authorId: string, profileUserId: string, input: { rating: number; body: string }) {
    await this.gate();
    const profile = await this.prisma.specialistProfile.findUnique({ where: { userId: profileUserId } });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.userId === authorId) throw new BadRequestException('You cannot review yourself');
    return this.prisma.workReview.create({
      data: {
        profileId: profile.id,
        authorId,
        rating: Math.min(5, Math.max(1, Math.floor(input.rating))),
        body: clean(input.body, 1000),
      },
    });
  }

  private async hasRole(userId: string, role: string) {
    const row = await this.prisma.departmentMembership.findFirst({
      where: { userId, department: 'work', role },
      select: { id: true },
    });
    return Boolean(row);
  }
}
