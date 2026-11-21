import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { ContractsService } from './contracts.service';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get('work-profile/:userId')
  workProfile(@Param('userId') userId: string) {
    return this.contracts.workProfile(userId);
  }

  @Get('lessons/:lessonId/materials')
  lessonMaterials(@Param('lessonId') lessonId: string) {
    return this.contracts.lessonMaterials(lessonId);
  }

  @Post('lessons/:lessonId/materials')
  @UseGuards(JwtAuthGuard)
  attach(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() body: { materialResourceId: string },
  ) {
    return this.contracts.attachMaterial(user, lessonId, body.materialResourceId);
  }

  @Post('events/:eventId/share')
  @UseGuards(JwtAuthGuard)
  shareEvent(@CurrentUser() user: AuthUser, @Param('eventId') eventId: string) {
    return this.contracts.shareEvent(user, eventId);
  }

  @Post('labs/:projectId/publish')
  @UseGuards(JwtAuthGuard)
  publishLab(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.contracts.publishLab(user, projectId);
  }
}
