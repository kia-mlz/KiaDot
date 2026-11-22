import { createReadStream, existsSync, statSync } from 'fs';
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { ProgressWriteDto } from './dto/motion.dto';
import { MotionService } from './motion.service';

@Controller('academy/motion')
export class MotionController {
  constructor(private readonly motion: MotionService) {}

  @Get('lessons/:lessonId')
  @UseGuards(JwtAuthGuard)
  lesson(@CurrentUser() user: AuthUser, @Param('lessonId') lessonId: string) {
    return this.motion.publishedForLesson(user.id, lessonId);
  }

  @Post('lessons/:lessonId/progress')
  @UseGuards(JwtAuthGuard)
  progress(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: ProgressWriteDto,
  ) {
    return this.motion.saveProgress(user.id, { ...dto, lessonId });
  }

  @Get('media/:projectId/:filename')
  async media(
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      res.status(401).json({ message: 'Video token required' });
      return;
    }
    const userId = this.motion.verifyMediaToken(token, projectId, filename);
    const absolute = await this.motion.resolveMediaPath(userId, projectId, filename);
    if (!existsSync(absolute)) {
      res.status(404).json({ message: 'Video file not found' });
      return;
    }
    streamFile(absolute, req, res);
  }
}

function streamFile(absolute: string, req: Request, res: Response): void {
  const size = statSync(absolute).size;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=60');
  const header = req.headers.range;
  if (!header) {
    res.setHeader('Content-Length', size);
    createReadStream(absolute).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= size || end >= size) {
    res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
    return;
  }
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
  res.setHeader('Content-Length', end - start + 1);
  createReadStream(absolute, { start, end }).pipe(res);
}
