import { Injectable } from '@nestjs/common';
import { PrismaService } from '@kia./platform';

const DEFAULT_CONTENT = {
  id: 'default',
  brandNameFa: 'کیادات',
  brandNameEn: 'KiaDot',
  sloganFa: 'یک اکوسیستم، فرصت‌های بی‌نهایت',
  sloganEn: 'One ecosystem, infinite opportunities',
  missionFa: 'کیادات آموزش، کار، منابع، آزمایشگاه، رویداد و جامعه را در یک هویت به هم وصل می‌کند.',
  missionEn: 'KiaDot connects learning, work, resources, research, events, and community under one identity.',
};

export interface PublicContent {
  brandNameFa: string;
  brandNameEn: string;
  sloganFa: string;
  sloganEn: string;
  missionFa: string;
  missionEn: string;
}

function toContent(row: PublicContent): PublicContent {
  return {
    brandNameFa: row.brandNameFa,
    brandNameEn: row.brandNameEn,
    sloganFa: row.sloganFa,
    sloganEn: row.sloganEn,
    missionFa: row.missionFa,
    missionEn: row.missionEn,
  };
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PublicContent> {
    const row = await this.prisma.platformContent.upsert({
      where: { id: 'default' },
      create: DEFAULT_CONTENT,
      update: {},
    });
    return toContent(row);
  }

  async update(patch: Partial<PublicContent>): Promise<PublicContent> {
    await this.get();
    const row = await this.prisma.platformContent.update({
      where: { id: 'default' },
      data: {
        brandNameFa: patch.brandNameFa?.slice(0, 80),
        brandNameEn: patch.brandNameEn?.slice(0, 80),
        sloganFa: patch.sloganFa?.slice(0, 200),
        sloganEn: patch.sloganEn?.slice(0, 200),
        missionFa: patch.missionFa?.slice(0, 500),
        missionEn: patch.missionEn?.slice(0, 500),
      },
    });
    return toContent(row);
  }
}
