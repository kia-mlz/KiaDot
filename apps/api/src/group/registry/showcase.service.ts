import { Injectable } from '@nestjs/common';
import { PrismaService } from '@kia./platform';
import {
  clipSummary,
  rankDemand,
  rankNewest,
  selectShowcaseDepartments,
  SHOWCASE_POOL,
  type ShowcaseCandidate,
  type ShowcaseItem,
} from './showcase.rank';
import { RegistryService, type DepartmentView } from './registry.service';

export interface ShowcaseDepartment {
  key: string;
  enabled: boolean;
  nameFa: string;
  nameEn: string;
  descriptionFa: string;
  descriptionEn: string;
  path: string;
  publishState: string;
}

export interface ShowcaseResponse {
  departments: ShowcaseDepartment[];
  newest: ShowcaseItem[];
  demand: ShowcaseItem[];
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  descriptionEn: string | null;
  comingSoon: boolean;
  createdAt: Date;
  _count: { enrollments: number };
}

interface MaterialRow {
  id: string;
  title: string;
  description: string;
  viewCount: number;
  createdAt: Date;
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  rules: string;
  category: string;
  createdAt: Date;
  _count: { signups: number };
}

interface JobRow {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  _count: { applications: number };
}

function optionalEnglish(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const clipped = clipSummary(value);
  return clipped || null;
}

function courseCandidate(row: CourseRow): ShowcaseCandidate {
  return {
    kind: 'course',
    id: row.id,
    title: row.title,
    summary: clipSummary(row.description),
    descriptionEn: optionalEnglish(row.descriptionEn),
    href: `/courses/${encodeURIComponent(row.slug)}`,
    createdAt: row.createdAt,
    demand: row._count.enrollments,
    demandKind: 'enrollments',
    department: 'academy',
    comingSoon: row.comingSoon,
  };
}

function materialCandidate(row: MaterialRow): ShowcaseCandidate {
  return {
    kind: 'material',
    id: row.id,
    title: row.title,
    summary: clipSummary(row.description),
    descriptionEn: null,
    href: '/material/catalog',
    createdAt: row.createdAt,
    demand: row.viewCount,
    demandKind: 'views',
    department: 'material',
  };
}

function eventCandidate(row: EventRow): ShowcaseCandidate {
  const rules = clipSummary(row.rules);
  return {
    kind: 'event',
    id: row.id,
    title: row.title,
    summary: rules || clipSummary(row.category),
    descriptionEn: null,
    href: `/events/live/${encodeURIComponent(row.slug)}`,
    createdAt: row.createdAt,
    demand: row._count.signups,
    demandKind: 'signups',
    department: 'events',
  };
}

function jobCandidate(row: JobRow): ShowcaseCandidate {
  return {
    kind: 'job',
    id: row.id,
    title: row.title,
    summary: clipSummary(row.description),
    descriptionEn: null,
    href: '/freelance',
    createdAt: row.createdAt,
    demand: row._count.applications,
    demandKind: 'applications',
    department: 'work',
  };
}

function toDepartment(row: DepartmentView): ShowcaseDepartment {
  return {
    key: row.key,
    enabled: row.enabled,
    nameFa: row.nameFa,
    nameEn: row.nameEn,
    descriptionFa: row.descriptionFa,
    descriptionEn: row.descriptionEn,
    path: row.path,
    publishState: row.publishState,
  };
}

@Injectable()
export class ShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async get(): Promise<ShowcaseResponse> {
    const departments = selectShowcaseDepartments(await this.registry.list()).map(toDepartment);
    const open = new Set(departments.map((department) => department.key));
    const newest: ShowcaseCandidate[] = [];
    const demand: ShowcaseCandidate[] = [];

    const loads: Promise<void>[] = [];
    if (open.has('academy')) loads.push(this.loadCourses(newest, demand));
    if (open.has('material')) loads.push(this.loadMaterials(newest, demand));
    if (open.has('events')) loads.push(this.loadEvents(newest, demand));
    if (open.has('work')) loads.push(this.loadJobs(newest, demand));
    await Promise.all(loads);

    return {
      departments,
      newest: rankNewest(newest),
      demand: rankDemand(demand),
    };
  }

  private async loadCourses(newest: ShowcaseCandidate[], demand: ShowcaseCandidate[]) {
    const select = {
      id: true,
      slug: true,
      title: true,
      description: true,
      descriptionEn: true,
      comingSoon: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    } as const;
    const [recent, popular] = await Promise.all([
      this.prisma.course.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: SHOWCASE_POOL,
        select,
      }),
      this.prisma.course.findMany({
        where: { published: true, enrollments: { some: {} } },
        orderBy: { enrollments: { _count: 'desc' } },
        take: SHOWCASE_POOL,
        select,
      }),
    ]);
    newest.push(...recent.map(courseCandidate));
    demand.push(...popular.map(courseCandidate));
  }

  private async loadMaterials(newest: ShowcaseCandidate[], demand: ShowcaseCandidate[]) {
    const select = {
      id: true,
      title: true,
      description: true,
      viewCount: true,
      createdAt: true,
    } as const;
    const [recent, popular] = await Promise.all([
      this.prisma.materialResource.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: SHOWCASE_POOL,
        select,
      }),
      this.prisma.materialResource.findMany({
        where: { published: true, viewCount: { gt: 0 } },
        orderBy: { viewCount: 'desc' },
        take: SHOWCASE_POOL,
        select,
      }),
    ]);
    newest.push(...recent.map(materialCandidate));
    demand.push(...popular.map(materialCandidate));
  }

  private async loadEvents(newest: ShowcaseCandidate[], demand: ShowcaseCandidate[]) {
    const select = {
      id: true,
      slug: true,
      title: true,
      rules: true,
      category: true,
      createdAt: true,
      _count: { select: { signups: true } },
    } as const;
    const [recent, popular] = await Promise.all([
      this.prisma.liveEvent.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: SHOWCASE_POOL,
        select,
      }),
      this.prisma.liveEvent.findMany({
        where: { published: true, signups: { some: {} } },
        orderBy: { signups: { _count: 'desc' } },
        take: SHOWCASE_POOL,
        select,
      }),
    ]);
    newest.push(...recent.map(eventCandidate));
    demand.push(...popular.map(eventCandidate));
  }

  private async loadJobs(newest: ShowcaseCandidate[], demand: ShowcaseCandidate[]) {
    const select = {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      _count: { select: { applications: true } },
    } as const;
    const [recent, popular] = await Promise.all([
      this.prisma.jobPost.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: SHOWCASE_POOL,
        select,
      }),
      this.prisma.jobPost.findMany({
        where: { published: true, applications: { some: {} } },
        orderBy: { applications: { _count: 'desc' } },
        take: SHOWCASE_POOL,
        select,
      }),
    ]);
    newest.push(...recent.map(jobCandidate));
    demand.push(...popular.map(jobCandidate));
  }
}
