import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DEPARTMENT_KEYS, type DepartmentKey } from '@kia./permissions';
import { PrismaService } from '@kia./platform';
import { AdminAuditService } from '../admin/audit.service';
import type { AuthUser } from '@kia./shared';

const DEFAULTS: Record<DepartmentKey, { nameFa: string; nameEn: string; path: string; brandToken: string; descriptionFa: string; descriptionEn: string }> = {
  academy: {
    nameFa: 'آکادمی',
    nameEn: 'Academy',
    path: '/academy',
    brandToken: '--dept-academy',
    descriptionFa: 'دوره‌ها، آزمون و گواهی',
    descriptionEn: 'Courses, exams, and certificates',
  },
  work: {
    nameFa: 'کار',
    nameEn: 'Work',
    path: '/work',
    brandToken: '--dept-work',
    descriptionFa: 'شغل، فریلنس و پروفایل تخصصی',
    descriptionEn: 'Jobs, freelance, and specialist profiles',
  },
  material: {
    nameFa: 'متریال',
    nameEn: 'Material',
    path: '/material',
    brandToken: '--dept-material',
    descriptionFa: 'منابع و فایل‌های آموزشی',
    descriptionEn: 'Learning resources and files',
  },
  labs: {
    nameFa: 'آزمایشگاه',
    nameEn: 'Labs',
    path: '/labs',
    brandToken: '--dept-labs',
    descriptionFa: 'پژوهش، آزمایش و ایده',
    descriptionEn: 'Research, experiments, and ideas',
  },
  events: {
    nameFa: 'رویداد',
    nameEn: 'Events',
    path: '/events',
    brandToken: '--dept-events',
    descriptionFa: 'رویداد، بلیت و حضور',
    descriptionEn: 'Events, tickets, and attendance',
  },
  community: {
    nameFa: 'جامعه',
    nameEn: 'Community',
    path: '/community',
    brandToken: '--dept-community',
    descriptionFa: 'گفتگو، گروه‌ها و پیام',
    descriptionEn: 'Posts, groups, and messages',
  },
};

export interface DepartmentView {
  key: string;
  enabled: boolean;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  descriptionEn: string;
  path: string;
  publishState: string;
  brandToken: string;
  logoUrl: string | null;
}

function toView(row: {
  key: string;
  enabled: boolean;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  descriptionEn: string;
  path: string;
  publishState: string;
  brandToken: string;
  logoUrl: string | null;
}): DepartmentView {
  return {
    key: row.key,
    enabled: row.enabled,
    nameFa: row.nameFa,
    nameEn: row.nameEn,
    descriptionFa: row.descriptionFa,
    descriptionEn: row.descriptionEn,
    path: row.path,
    publishState: row.publishState,
    brandToken: row.brandToken,
    logoUrl: row.logoUrl,
  };
}

@Injectable()
export class RegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async ensureDefaults() {
    for (const key of DEPARTMENT_KEYS) {
      const item = DEFAULTS[key];
      await this.prisma.departmentRegistry.upsert({
        where: { key },
        create: { key, enabled: true, publishState: 'published', featureFlags: {}, ...item },
        update: {},
      });
    }
  }

  async list(): Promise<DepartmentView[]> {
    await this.ensureDefaults();
    const rows = await this.prisma.departmentRegistry.findMany({ orderBy: { key: 'asc' } });
    return rows.map(toView);
  }

  async get(key: string): Promise<DepartmentView> {
    if (!DEPARTMENT_KEYS.includes(key as DepartmentKey)) throw new NotFoundException('Department not found');
    await this.ensureDefaults();
    const row = await this.prisma.departmentRegistry.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('Department not found');
    return toView(row);
  }

  async update(
    actor: AuthUser,
    key: string,
    patch: { enabled?: boolean; nameFa?: string; nameEn?: string; descriptionFa?: string; descriptionEn?: string; path?: string; publishState?: string; logoUrl?: string | null },
  ): Promise<DepartmentView> {
    const before = await this.get(key);
    const previous = before;
    if (patch.path && !patch.path.startsWith('/')) throw new BadRequestException('Invalid path');
    const afterRow = await this.prisma.departmentRegistry.update({
      where: { key },
      data: {
        enabled: patch.enabled,
        nameFa: patch.nameFa,
        nameEn: patch.nameEn,
        descriptionFa: patch.descriptionFa,
        descriptionEn: patch.descriptionEn,
        path: patch.path,
        publishState: patch.publishState,
        logoUrl: patch.logoUrl,
      },
    });
    const after = toView(afterRow);
    await this.audit.record({
      actor,
      action: 'department.update',
      section: 'settings',
      entityType: 'DepartmentRegistry',
      entityId: key,
      target: key,
      before: previous,
      after,
    });
    return after;
  }
}
