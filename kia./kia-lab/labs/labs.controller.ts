import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard, OptionalJwtAuthGuard } from '@kia./platform';
import { LabsService } from './labs.service';

@Controller('labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  @Get('projects')
  @UseGuards(OptionalJwtAuthGuard)
  list(@CurrentUser() user?: AuthUser) {
    return this.labs.list(user?.id);
  }

  @Post('projects')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title: string; problem: string; method: string; schedule?: string },
  ) {
    return this.labs.create(user.id, body);
  }

  @Post('projects/:id/members')
  @UseGuards(JwtAuthGuard)
  member(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { userId: string; role?: string }) {
    return this.labs.addMember(user.id, id, body.userId, body.role);
  }

  @Post('projects/:id/phases')
  @UseGuards(JwtAuthGuard)
  phase(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title: string }) {
    return this.labs.addPhase(user.id, id, body.title);
  }

  @Post('projects/:id/experiments')
  @UseGuards(JwtAuthGuard)
  experiment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { hypothesis: string; results?: string; report?: string },
  ) {
    return this.labs.addExperiment(user.id, id, body);
  }

  @Post('projects/:id/tasks')
  @UseGuards(JwtAuthGuard)
  task(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title: string; assigneeId?: string },
  ) {
    return this.labs.addTask(user.id, id, body.title, body.assigneeId);
  }

  @Patch('tasks/:id')
  @UseGuards(JwtAuthGuard)
  setTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { status: string }) {
    return this.labs.setTask(user.id, id, body.status);
  }

  @Post('projects/:id/reports')
  @UseGuards(JwtAuthGuard)
  report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { body: string }) {
    return this.labs.addReport(user.id, id, body.body);
  }

  @Patch('projects/:id/visibility')
  @UseGuards(JwtAuthGuard)
  visibility(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { visibility: 'public' | 'private' },
  ) {
    return this.labs.setVisibility(user.id, id, body.visibility);
  }

  @Get('ideas')
  ideas() {
    return this.labs.listIdeas();
  }

  @Post('ideas')
  @UseGuards(JwtAuthGuard)
  idea(@CurrentUser() user: AuthUser, @Body() body: { title: string; body: string }) {
    return this.labs.submitIdea(user.id, body);
  }

  @Post('ideas/:id/score')
  @UseGuards(JwtAuthGuard)
  score(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { score: number }) {
    return this.labs.scoreIdea(user.id, user.role, id, body.score);
  }

  @Post('ideas/:id/convert')
  @UseGuards(JwtAuthGuard)
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.labs.convertIdea(user.id, user.role, id);
  }
}
