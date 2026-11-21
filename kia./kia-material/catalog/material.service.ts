import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { containsUnsafeText } from '@kia./shared';
import { assertDepartmentEnabled, PrismaService, resolveUnderRoot } from '@kia./platform';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'text/plain',
  'application/zip',
]);
const MAX_BYTES = 25 * 1024 * 1024;

function clean(value: string, max: number): string {
  const text = value.trim();
  if (!text || text.length > max || containsUnsafeText(text)) throw new BadRequestException('Invalid text');
  return text;
}

@Injectable()
export class MaterialCatalogService {
  private readonly root = join(process.cwd(), 'uploads', 'material');

  constructor(private readonly prisma: PrismaService) {
    mkdirSync(this.root, { recursive: true });
  }

  private gate() {
    return assertDepartmentEnabled(this.prisma, 'material');
  }

  async list(category?: string) {
    await this.gate();
    return this.prisma.materialResource.findMany({
      where: { published: true, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        tags: true,
        kind: true,
        access: true,
        priceIrr: true,
        authorId: true,
        version: true,
        viewCount: true,
      },
    });
  }

  async get(slug: string) {
    await this.gate();
    const resource = await this.prisma.materialResource.findFirst({
      where: { slug, published: true },
      include: { files: { select: { id: true, filename: true, mime: true, sizeBytes: true } } },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    await this.prisma.materialResource.update({
      where: { id: resource.id },
      data: { viewCount: { increment: 1 } },
    });
    return resource;
  }

  async create(authorId: string, input: Record<string, unknown>) {
    await this.gate();
    const title = clean(String(input.title ?? ''), 160);
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'resource';
    const access = ['free', 'paid', 'subscription'].includes(String(input.access))
      ? String(input.access)
      : 'free';
    return this.prisma.materialResource.create({
      data: {
        authorId,
        title,
        slug: `${slugBase}-${randomBytes(3).toString('hex')}`,
        description: clean(String(input.description ?? ''), 8000),
        category: clean(String(input.category ?? 'general'), 60),
        tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).slice(0, 40)).slice(0, 12) : [],
        kind: clean(String(input.kind ?? 'pdf'), 40),
        access,
        priceIrr: access === 'free' ? 0 : Math.max(0, Math.floor(Number(input.priceIrr) || 0)),
        published: Boolean(input.published),
      },
    });
  }

  async update(actorId: string, role: string, id: string, input: { published?: boolean; description?: string }) {
    await this.gate();
    const resource = await this.mustAuthor(actorId, role, id);
    return this.prisma.materialResource.update({
      where: { id: resource.id },
      data: {
        published: input.published,
        description: input.description ? clean(input.description, 8000) : undefined,
        version: { increment: 1 },
      },
    });
  }

  async addFile(actorId: string, role: string, resourceId: string, file: Express.Multer.File) {
    await this.gate();
    await this.mustAuthor(actorId, role, resourceId);
    if (!file?.buffer) throw new BadRequestException('File is required');
    if (!ALLOWED_MIME.has(file.mimetype) || file.size > MAX_BYTES) {
      throw new BadRequestException('Unsupported file');
    }
    const storageKey = randomBytes(24).toString('hex');
    const path = resolveUnderRoot(this.root, storageKey);
    writeFileSync(path, file.buffer);
    return this.prisma.materialFile.create({
      data: {
        resourceId,
        filename: file.originalname.slice(0, 180),
        mime: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      },
      select: { id: true, filename: true, mime: true, sizeBytes: true },
    });
  }

  async checkout(userId: string, resourceId: string) {
    await this.gate();
    const resource = await this.prisma.materialResource.findFirst({ where: { id: resourceId, published: true } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.access === 'free' || resource.priceIrr <= 0) {
      throw new BadRequestException('This resource is free');
    }
    const days = resource.access === 'subscription' ? 30 : null;
    return this.prisma.departmentInvoice.create({
      data: {
        userId,
        department: 'material',
        resourceType: resource.access,
        resourceId: resource.id,
        title: resource.title,
        amountIrr: resource.priceIrr,
        status: 'pending',
        accessUntil: days ? new Date(Date.now() + days * 86400_000) : null,
      },
    });
  }

  /** Issue a short-lived token. The file bytes are not a public URL. */
  async createDownload(userId: string, fileId: string) {
    await this.gate();
    const file = await this.prisma.materialFile.findUnique({
      where: { id: fileId },
      include: { resource: true },
    });
    if (!file || !file.resource.published) throw new NotFoundException('File not found');
    const allowed = await this.canRead(userId, file.resource);
    if (!allowed) throw new ForbiddenException('Purchase required');
    const raw = randomBytes(32).toString('hex');
    await this.prisma.materialDownloadToken.create({
      data: {
        fileId,
        userId,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return { token: raw, expiresInSeconds: 600 };
  }

  async readDownload(rawToken: string, userId: string) {
    await this.gate();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.prisma.materialDownloadToken.findUnique({
      where: { tokenHash },
      include: { file: { include: { resource: true } } },
    });
    if (!token || token.expiresAt < new Date() || token.userId !== userId) {
      throw new ForbiddenException('Download denied');
    }
    const path = resolveUnderRoot(this.root, token.file.storageKey);
    const bytes = readFileSync(path);
    return { filename: token.file.filename, mime: token.file.mime, bytes };
  }

  async creatorStats(authorId: string) {
    await this.gate();
    const resources = await this.prisma.materialResource.findMany({ where: { authorId } });
    const ids = resources.map((r) => r.id);
    const [orders, views] = await Promise.all([
      this.prisma.departmentInvoice.findMany({
        where: { department: 'material', resourceId: { in: ids }, status: 'paid' },
      }),
      Promise.resolve(resources.reduce((sum, r) => sum + r.viewCount, 0)),
    ]);
    return {
      resources: resources.length,
      views,
      orders: orders.length,
      revenueIrr: orders.reduce((sum, o) => sum + o.amountIrr - o.discountIrr, 0),
    };
  }

  async canRead(
    userId: string,
    resource: { id: string; authorId: string; access: string; published: boolean },
  ) {
    if (resource.authorId === userId) return true;
    if (resource.access === 'free' && resource.published) return true;
    const invoice = await this.prisma.departmentInvoice.findFirst({
      where: { userId, resourceId: resource.id, status: 'paid' },
    });
    if (!invoice) return false;
    if (invoice.accessUntil && invoice.accessUntil < new Date()) return false;
    return true;
  }

  private async mustAuthor(actorId: string, role: string, id: string) {
    const resource = await this.prisma.materialResource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException('Resource not found');
    if (resource.authorId === actorId || role === 'SUPER_ADMIN') return resource;
    const member = await this.prisma.departmentMembership.findFirst({
      where: { userId: actorId, department: 'material', role: 'MATERIAL_ADMIN' },
    });
    if (!member) throw new ForbiddenException('Insufficient permissions');
    return resource;
  }
}
