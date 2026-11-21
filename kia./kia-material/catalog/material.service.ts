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

const MAX_BYTES = 25 * 1024 * 1024;

/** Server-chosen extension for each allowed MIME. The client filename is never a path. */
const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'text/plain': '.txt',
  'application/zip': '.zip',
};

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function magicMatches(mime: string, buffer: Buffer): boolean {
  switch (mime) {
    case 'application/pdf':
      return buffer.length >= 5 && startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case 'image/png':
      return buffer.length >= 8 && startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return buffer.length >= 3 && startsWith(buffer, [0xff, 0xd8, 0xff]);
    case 'image/webp':
      return buffer.length >= 12 && startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'audio/mpeg':
      return buffer.length >= 3 && (startsWith(buffer, [0x49, 0x44, 0x33]) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
    case 'audio/mp4':
    case 'video/mp4':
      return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'application/zip':
      return (
        buffer.length >= 4 &&
        (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
          startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
          startsWith(buffer, [0x50, 0x4b, 0x07, 0x08]))
      );
    case 'text/plain': {
      if (buffer.length === 0 || buffer.includes(0)) return false;
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        return !/<\s*(?:script|html|iframe)\b/i.test(text);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Accept an upload only when the declared type, size, and leading bytes agree.
 * The returned name is generated here. `originalname` is not used as a path or a stored name.
 */
export function inspectMaterialUpload(file: {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}): { bytes: Buffer; mime: string; filename: string } {
  const mime = file.mimetype ?? '';
  const extension = MIME_EXTENSION[mime];
  const size = file.size ?? file.buffer?.length ?? 0;
  if (!file.buffer || !extension || size <= 0 || size > MAX_BYTES || file.buffer.length !== size) {
    throw new BadRequestException('Unsupported file');
  }
  if (!magicMatches(mime, file.buffer)) throw new BadRequestException('Unsupported file');
  return { bytes: Buffer.from(file.buffer), mime, filename: `material${extension}` };
}

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
    const accepted = inspectMaterialUpload(file);
    const storageKey = randomBytes(24).toString('hex');
    if (!/^[a-f0-9]{48}$/.test(storageKey)) throw new BadRequestException('Invalid path');
    const path = resolveUnderRoot(this.root, storageKey);
    writeFileSync(path, accepted.bytes);
    return this.prisma.materialFile.create({
      data: {
        resourceId,
        filename: accepted.filename,
        mime: accepted.mime,
        sizeBytes: accepted.bytes.length,
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
