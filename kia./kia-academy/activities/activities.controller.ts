import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { AcademyActivitiesService } from './activities.service';

@Controller('academy')
export class AcademyActivitiesController {
  constructor(private readonly academy: AcademyActivitiesService) {}

  @Get('activities')
  list(@Query('courseId') courseId?: string) {
    return this.academy.list(courseId);
  }

  @Post('activities')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title: string; kind: string; payload: unknown; courseId?: string; lessonId?: string; timeLimitSec?: number },
  ) {
    return this.academy.create(user.role, body);
  }

  @Post('activities/:id/open')
  @UseGuards(JwtAuthGuard)
  open(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.academy.open(user.id, id);
  }

  @Post('activities/:id/submit')
  @UseGuards(JwtAuthGuard)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { token: string; submission: unknown },
  ) {
    return this.academy.submit(user.id, id, body.token, body.submission);
  }

  @Get('certificates')
  @UseGuards(JwtAuthGuard)
  certificates(@CurrentUser() user: AuthUser) {
    return this.academy.myCertificates(user.id);
  }

  @Post('certificates/claim')
  @UseGuards(JwtAuthGuard)
  claim(@CurrentUser() user: AuthUser, @Body() body: { courseId: string }) {
    return this.academy.claimCertificate(user.id, body.courseId);
  }

  @Get('sessions')
  sessions(@Query('courseId') courseId: string) {
    return this.academy.listSessions(courseId);
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  createSession(
    @CurrentUser() user: AuthUser,
    @Body() body: { courseId: string; title: string; startsAt: string; endsAt?: string; joinUrl?: string },
  ) {
    return this.academy.createSession(user.id, user.role, body);
  }

  @Post('sessions/:id/attend')
  @UseGuards(JwtAuthGuard)
  attend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.academy.attend(user.id, id);
  }
}
