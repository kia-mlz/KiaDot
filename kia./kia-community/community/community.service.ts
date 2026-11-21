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
  if (!text || text.length > max || containsUnsafeText(text)) throw new BadRequestException('Invalid text');
  return text;
}

function tags(raw: string): string[] {
  return [...new Set(raw.split(/\s+/).map((t) => t.replace(/^#/, '').slice(0, 40)).filter(Boolean))].slice(0, 8);
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'community');
  }

  private async assertActive(userId: string) {
    const row = await this.prisma.communityRestriction.findUnique({ where: { userId } });
    if (!row) return;
    if (row.suspendedUntil && row.suspendedUntil > new Date()) {
      throw new ForbiddenException('Account restricted');
    }
    if (row.muted) throw new ForbiddenException('Account restricted');
  }

  async feed() {
    await this.gate();
    return this.prisma.communityPost.findMany({
      where: { deletedAt: null, visibility: 'public' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
  }

  async createPost(authorId: string, input: { body: string; linkUrl?: string; hashtags?: string }) {
    await this.gate();
    await this.assertActive(authorId);
    const recent = await this.prisma.communityPost.count({
      where: { authorId, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 5) throw new BadRequestException('Slow down');
    const post = await this.prisma.communityPost.create({
      data: {
        authorId,
        body: clean(input.body, 4000),
        linkUrl: input.linkUrl?.slice(0, 500) || null,
        hashtags: tags(input.hashtags ?? ''),
      },
    });
    await this.events.publish({
      name: 'community.post.created',
      occurredAt: new Date().toISOString(),
      userId: authorId,
      postId: post.id,
      dedupeKey: `post:${post.id}`,
    });
    return post;
  }

  async editPost(userId: string, postId: string, body: string) {
    await this.gate();
    const post = await this.mustOwn(userId, postId);
    return this.prisma.communityPost.update({ where: { id: post.id }, data: { body: clean(body, 4000) } });
  }

  async deletePost(userId: string, role: string, postId: string) {
    await this.gate();
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && role !== 'SUPER_ADMIN' && !(await this.isMod(userId))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  async like(userId: string, postId: string) {
    await this.gate();
    await this.prisma.communityLike.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId },
      update: {},
    });
    return { liked: true };
  }

  async unlike(userId: string, postId: string) {
    await this.gate();
    await this.prisma.communityLike.deleteMany({ where: { postId, userId } });
    return { liked: false };
  }

  async save(userId: string, postId: string) {
    await this.gate();
    await this.prisma.communitySave.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId },
      update: {},
    });
    return { saved: true };
  }

  async comment(userId: string, postId: string, body: string, parentId?: string) {
    await this.gate();
    await this.assertActive(userId);
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.communityComment.create({
      data: { postId, authorId: userId, body: clean(body, 2000), parentId: parentId || null },
    });
  }

  async comments(postId: string) {
    await this.gate();
    return this.prisma.communityComment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async follow(followerId: string, followingId: string) {
    await this.gate();
    if (followerId === followingId) throw new BadRequestException('Invalid follow');
    const blocked = await this.prisma.communityBlock.findFirst({
      where: {
        OR: [
          { blockerId: followerId, blockedId: followingId },
          { blockerId: followingId, blockedId: followerId },
        ],
      },
    });
    if (blocked) throw new ForbiddenException('Blocked');
    await this.prisma.communityFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
    return { following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.gate();
    await this.prisma.communityFollow.deleteMany({ where: { followerId, followingId } });
    return { following: false };
  }

  async createGroup(ownerId: string, input: { name: string; rules?: string; visibility?: string }) {
    await this.gate();
    const name = clean(input.name, 80);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'group'}-${Date.now().toString(36)}`;
    const visibility = input.visibility === 'private' ? 'private' : 'public';
    return this.prisma.communityGroup.create({
      data: {
        ownerId,
        name,
        slug,
        rules: input.rules ? clean(input.rules, 2000) : '',
        visibility,
        members: { create: { userId: ownerId, role: 'owner' } },
      },
    });
  }

  async joinGroup(userId: string, slug: string) {
    await this.gate();
    const group = await this.prisma.communityGroup.findUnique({ where: { slug } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.visibility === 'private') throw new ForbiddenException('Private group');
    return this.prisma.communityGroupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId, role: 'member' },
      update: {},
    });
  }

  async listGroups() {
    await this.gate();
    return this.prisma.communityGroup.findMany({
      where: { visibility: 'public' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendMessage(senderId: string, input: { recipientId?: string; groupId?: string; body: string }) {
    await this.gate();
    await this.assertActive(senderId);
    if (!input.recipientId && !input.groupId) throw new BadRequestException('Recipient required');
    if (input.recipientId) {
      const blocked = await this.prisma.communityBlock.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: input.recipientId },
            { blockerId: input.recipientId, blockedId: senderId },
          ],
        },
      });
      if (blocked) throw new ForbiddenException('Blocked');
    }
    if (input.groupId) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId: senderId } },
      });
      if (!member) throw new ForbiddenException('Insufficient permissions');
    }
    return this.prisma.communityMessage.create({
      data: {
        senderId,
        recipientId: input.recipientId || null,
        groupId: input.groupId || null,
        body: clean(input.body, 2000),
      },
    });
  }

  async inbox(userId: string) {
    await this.gate();
    return this.prisma.communityMessage.findMany({
      where: { OR: [{ recipientId: userId }, { senderId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, messageId: string) {
    await this.gate();
    const message = await this.prisma.communityMessage.findFirst({ where: { id: messageId, recipientId: userId } });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.communityMessage.update({ where: { id: messageId }, data: { readAt: new Date() } });
  }

  async block(blockerId: string, blockedId: string) {
    await this.gate();
    await this.prisma.communityBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    await this.prisma.communityFollow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    });
    return { blocked: true };
  }

  async report(reporterId: string, input: { targetType: string; targetId: string; reason: string }) {
    await this.gate();
    if (!['post', 'comment', 'user', 'message'].includes(input.targetType)) {
      throw new BadRequestException('Invalid target');
    }
    return this.prisma.communityReport.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: clean(input.reason, 500),
      },
    });
  }

  async listReports(actorId: string, role: string) {
    await this.gate();
    if (role !== 'SUPER_ADMIN' && !(await this.isMod(actorId))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.prisma.communityReport.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' } });
  }

  async restrict(actorId: string, role: string, userId: string, input: { muted?: boolean; hours?: number; reason?: string }) {
    await this.gate();
    if (role !== 'SUPER_ADMIN' && !(await this.isMod(actorId))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    const until = input.hours ? new Date(Date.now() + input.hours * 3600_000) : null;
    return this.prisma.communityRestriction.upsert({
      where: { userId },
      create: {
        userId,
        muted: Boolean(input.muted),
        suspendedUntil: until,
        reason: input.reason?.slice(0, 300) ?? '',
      },
      update: {
        muted: Boolean(input.muted),
        suspendedUntil: until,
        reason: input.reason?.slice(0, 300) ?? '',
      },
    });
  }

  async shareFromContract(input: { authorId: string; body: string; sourceType: string; sourceId: string }) {
    await this.gate();
    const existing = await this.prisma.communityShare.findUnique({
      where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
    });
    if (existing) return existing;
    const post = await this.prisma.communityPost.create({
      data: { authorId: input.authorId, body: clean(input.body, 4000) },
    });
    return this.prisma.communityShare.create({
      data: { postId: post.id, sourceType: input.sourceType, sourceId: input.sourceId },
    });
  }

  private async mustOwn(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findFirst({ where: { id: postId, deletedAt: null } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) throw new ForbiddenException('Insufficient permissions');
    return post;
  }

  private async isMod(userId: string) {
    const row = await this.prisma.departmentMembership.findFirst({
      where: { userId, department: 'community', role: { in: ['COMMUNITY_ADMIN', 'MODERATOR'] } },
      select: { id: true },
    });
    return Boolean(row);
  }
}
