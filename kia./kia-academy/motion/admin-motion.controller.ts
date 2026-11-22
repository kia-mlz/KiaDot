import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@kia./shared';
import { AdminAccess, AdminAccessGuard, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@kia./platform';
import {
  CreateMotionProjectDto,
  PublishMotionDto,
  ReorderScenesDto,
  SceneWriteDto,
  SubtitleWriteDto,
  UpdateMotionProjectDto,
  UpdateMotionSettingsDto,
} from './dto/motion.dto';
import { MotionJobRunner } from './motion-job.runner';
import { MotionService } from './motion.service';

type UploadFile = { buffer: Buffer; mimetype: string; size: number; originalname: string };

@Controller('admin/academy/motion')
@UseGuards(JwtAuthGuard, RolesGuard, AdminAccessGuard)
@Roles('ADMIN')
export class AdminMotionController {
  constructor(
    private readonly motion: MotionService,
    private readonly runner: MotionJobRunner,
  ) {}

  @Get('dashboard')
  @AdminAccess('courses', 'view')
  dashboard() {
    return this.motion.dashboard();
  }

  @Get('settings')
  @AdminAccess('courses', 'view')
  settings() {
    return this.motion.settingsView();
  }

  @Patch('settings')
  @AdminAccess('courses', 'edit')
  updateSettings(@Body() dto: UpdateMotionSettingsDto) {
    return this.motion.updateSettings(dto);
  }

  @Get('catalog')
  @AdminAccess('courses', 'view')
  catalog() {
    return this.motion.catalog();
  }

  @Get('projects')
  @AdminAccess('courses', 'view')
  list(@Query('lessonId') lessonId?: string) {
    return this.motion.listProjects(lessonId);
  }

  @Post('projects')
  @AdminAccess('courses', 'edit')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMotionProjectDto) {
    return this.motion.createProject(user.id, dto);
  }

  @Get('projects/:id')
  @AdminAccess('courses', 'view')
  get(@Param('id') id: string) {
    return this.motion.getProject(id);
  }

  @Patch('projects/:id')
  @AdminAccess('courses', 'edit')
  update(@Param('id') id: string, @Body() dto: UpdateMotionProjectDto) {
    return this.motion.updateProject(id, dto);
  }

  @Post('projects/:id/analyze')
  @AdminAccess('courses', 'edit')
  analyze(@Param('id') id: string) {
    return this.motion.queueAnalyze(id);
  }

  @Post('projects/:id/approve')
  @AdminAccess('courses', 'edit')
  approve(@Param('id') id: string) {
    return this.motion.approve(id);
  }

  @Post('projects/:id/render')
  @AdminAccess('courses', 'edit')
  render(@Param('id') id: string) {
    return this.motion.queueRender(id);
  }

  @Post('projects/:id/publish')
  @AdminAccess('courses', 'edit')
  publish(@Param('id') id: string, @Body() dto: PublishMotionDto) {
    return this.motion.publish(id, dto);
  }

  @Post('projects/:id/unpublish')
  @AdminAccess('courses', 'edit')
  unpublish(@Param('id') id: string) {
    return this.motion.unpublish(id);
  }

  @Post('projects/:id/archive')
  @AdminAccess('courses', 'edit')
  archive(@Param('id') id: string) {
    return this.motion.archive(id);
  }

  @Delete('projects/:id')
  @AdminAccess('courses', 'edit')
  remove(@Param('id') id: string) {
    return this.motion.remove(id);
  }

  @Post('projects/:id/version')
  @AdminAccess('courses', 'edit')
  version(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.motion.newVersion(id, user.id);
  }

  @Get('lessons/:lessonId/history')
  @AdminAccess('courses', 'view')
  history(@Param('lessonId') lessonId: string) {
    return this.motion.history(lessonId);
  }

  @Patch('projects/:id/scenes/reorder')
  @AdminAccess('courses', 'edit')
  reorder(@Param('id') id: string, @Body() dto: ReorderScenesDto) {
    return this.motion.reorder(id, dto.orderedIds);
  }

  @Post('projects/:id/scenes')
  @AdminAccess('courses', 'edit')
  addScene(@Param('id') id: string) {
    return this.motion.addScene(id);
  }

  @Patch('projects/:id/scenes/:sceneId')
  @AdminAccess('courses', 'edit')
  updateScene(@Param('id') id: string, @Param('sceneId') sceneId: string, @Body() dto: SceneWriteDto) {
    return this.motion.updateScene(id, sceneId, dto);
  }

  @Delete('projects/:id/scenes/:sceneId')
  @AdminAccess('courses', 'edit')
  deleteScene(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.motion.deleteScene(id, sceneId);
  }

  @Get('projects/:id/scenes/:sceneId/preview')
  @AdminAccess('courses', 'view')
  preview(@Param('id') id: string, @Param('sceneId') sceneId: string) {
    return this.motion.preview(id, sceneId);
  }

  @Post('projects/:id/audio')
  @AdminAccess('courses', 'edit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  audio(@Param('id') id: string, @UploadedFile() file: UploadFile) {
    return this.motion.saveAudio(id, file);
  }

  @Patch('projects/:id/subtitles')
  @AdminAccess('courses', 'edit')
  subtitles(@Param('id') id: string, @Body() dto: SubtitleWriteDto) {
    return this.motion.saveSubtitle(id, dto);
  }

  @Post('projects/:id/cleanup')
  @AdminAccess('courses', 'edit')
  cleanup(@Param('id') id: string) {
    return this.motion.queueCleanup(id);
  }

  @Post('jobs/:id/cancel')
  @AdminAccess('courses', 'edit')
  async cancel(@Param('id') id: string) {
    const project = await this.motion.cancelJob(id);
    this.runner.abort(id);
    return project;
  }

  @Post('jobs/:id/retry')
  @AdminAccess('courses', 'edit')
  retry(@Param('id') id: string) {
    return this.motion.retryJob(id);
  }
}
