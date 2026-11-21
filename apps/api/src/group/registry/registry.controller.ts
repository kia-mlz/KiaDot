import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@kia./platform';
import { ContentService } from './content.service';
import { RegistryService } from './registry.service';

@Controller()
export class RegistryController {
  constructor(
    private readonly registry: RegistryService,
    private readonly content: ContentService,
  ) {}

  @Get('departments')
  list() {
    return this.registry.list();
  }

  @Get('departments/:key')
  get(@Param('key') key: string) {
    return this.registry.get(key);
  }

  @Patch('departments/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body()
    body: {
      enabled?: boolean;
      nameFa?: string;
      nameEn?: string;
      descriptionFa?: string;
      descriptionEn?: string;
      path?: string;
      publishState?: string;
      logoUrl?: string | null;
    },
  ) {
    return this.registry.update(user, key, body);
  }

  @Get('content')
  publicContent() {
    return this.content.get();
  }

  @Patch('content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  updateContent(
    @Body()
    body: {
      brandNameFa?: string;
      brandNameEn?: string;
      sloganFa?: string;
      sloganEn?: string;
      missionFa?: string;
      missionEn?: string;
    },
  ) {
    return this.content.update(body);
  }
}
