import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { PrismaService } from '@kia./platform';
import { CommunityService } from '@kia./kia-community';
import { LabsService } from '@kia./kia-lab';

/**
 * Cross-department reads live in the API shell. Department packages do not
 * import each other; this service is the contract.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly community: CommunityService,
    private readonly labs: LabsService,
  ) {}

  async workProfile(userId: string) {
    const profile = await this.prisma.specialistProfile.findFirst({
      where: { userId, published: true },
      include: {
        reviews: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const [skills, certificates] = await Promise.all([
      this.prisma.userSkill.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.certificate.findMany({
        where: { userId },
        include: { course: { select: { title: true, slug: true } } },
      }),
    ]);
    return { profile, skills, certificates };
  }

  async attachMaterial(actor: AuthUser, lessonId: string, materialResourceId: string) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const instructor = await this.prisma.departmentMembership.findFirst({
        where: { userId: actor.id, department: 'academy', role: { in: ['INSTRUCTOR', 'ACADEMY_ADMIN'] } },
      });
      if (!instructor) throw new ForbiddenException('Insufficient permissions');
    }
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const material = await this.prisma.materialResource.findFirst({
      where: { id: materialResourceId, published: true },
    });
    if (!material) throw new NotFoundException('Resource not found');
    return this.prisma.lessonMaterialLink.upsert({
      where: { lessonId_materialResourceId: { lessonId, materialResourceId } },
      create: { lessonId, materialResourceId, createdById: actor.id },
      update: {},
    });
  }

  async lessonMaterials(lessonId: string) {
    const links = await this.prisma.lessonMaterialLink.findMany({ where: { lessonId } });
    if (links.length === 0) return [];
    return this.prisma.materialResource.findMany({
      where: { id: { in: links.map((link) => link.materialResourceId) }, published: true },
      select: { id: true, slug: true, title: true, kind: true, access: true },
    });
  }

  async shareEvent(actor: AuthUser, eventId: string) {
    const event = await this.prisma.liveEvent.findFirst({ where: { id: eventId, published: true } });
    if (!event) throw new NotFoundException('Event not found');
    const signup = await this.prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId: actor.id } },
    });
    if (event.organizerId !== actor.id && !signup) throw new ForbiddenException('Insufficient permissions');
    return this.community.shareFromContract({
      authorId: actor.id,
      body: `${event.title}\n${event.venue || event.category}`,
      sourceType: 'event',
      sourceId: event.id,
    });
  }

  async publishLab(actor: AuthUser, projectId: string) {
    const project = await this.prisma.labProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.leadId !== actor.id && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (project.visibility !== 'public') throw new BadRequestException('Project is private');
    const share = await this.community.shareFromContract({
      authorId: actor.id,
      body: `${project.title}\n${project.problem}`,
      sourceType: 'lab',
      sourceId: project.id,
    });
    await this.labs.markPublished(project.id, actor.id, share.postId);
    return share;
  }
}
