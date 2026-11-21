import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { MaterialCatalogService } from './material.service';

@Controller('material')
export class MaterialCatalogController {
  constructor(private readonly catalog: MaterialCatalogService) {}

  @Get('resources')
  list(@Query('category') category?: string) {
    return this.catalog.list(category);
  }

  @Get('resources/:slug')
  get(@Param('slug') slug: string) {
    return this.catalog.get(slug);
  }

  @Post('resources')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.catalog.create(user.id, body);
  }

  @Patch('resources/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { published?: boolean; description?: string },
  ) {
    return this.catalog.update(user.id, user.role, id, body);
  }

  @Post('resources/:id/files')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.catalog.addFile(user.id, user.role, id, file);
  }

  @Post('resources/:id/checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.checkout(user.id, id);
  }

  @Post('files/:id/download')
  @UseGuards(JwtAuthGuard)
  download(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.createDownload(user.id, id);
  }

  @Get('downloads/:token')
  @UseGuards(JwtAuthGuard)
  async stream(@CurrentUser() user: AuthUser, @Param('token') token: string, @Res() res: Response) {
    const file = await this.catalog.readDownload(token, user.id);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.bytes);
  }

  @Get('creator/stats')
  @UseGuards(JwtAuthGuard)
  stats(@CurrentUser() user: AuthUser) {
    return this.catalog.creatorStats(user.id);
  }
}
