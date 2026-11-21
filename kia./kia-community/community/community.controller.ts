import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('posts')
  feed() {
    return this.community.feed();
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: { body: string; linkUrl?: string; hashtags?: string }) {
    return this.community.createPost(user.id, body);
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { body: string }) {
    return this.community.editPost(user.id, id, body.body);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.deletePost(user.id, user.role, id);
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.like(user.id, id);
  }

  @Delete('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  unlike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.unlike(user.id, id);
  }

  @Post('posts/:id/save')
  @UseGuards(JwtAuthGuard)
  save(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.save(user.id, id);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string) {
    return this.community.comments(id);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { body: string; parentId?: string },
  ) {
    return this.community.comment(user.id, id, body.body, body.parentId);
  }

  @Post('follow/:userId')
  @UseGuards(JwtAuthGuard)
  follow(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.community.follow(user.id, userId);
  }

  @Delete('follow/:userId')
  @UseGuards(JwtAuthGuard)
  unfollow(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.community.unfollow(user.id, userId);
  }

  @Get('groups')
  groups() {
    return this.community.listGroups();
  }

  @Post('groups')
  @UseGuards(JwtAuthGuard)
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; rules?: string; visibility?: string },
  ) {
    return this.community.createGroup(user.id, body);
  }

  @Post('groups/:slug/join')
  @UseGuards(JwtAuthGuard)
  join(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    return this.community.joinGroup(user.id, slug);
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard)
  inbox(@CurrentUser() user: AuthUser) {
    return this.community.inbox(user.id);
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  send(
    @CurrentUser() user: AuthUser,
    @Body() body: { recipientId?: string; groupId?: string; body: string },
  ) {
    return this.community.sendMessage(user.id, body);
  }

  @Post('messages/:id/read')
  @UseGuards(JwtAuthGuard)
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.markRead(user.id, id);
  }

  @Post('blocks/:userId')
  @UseGuards(JwtAuthGuard)
  block(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.community.block(user.id, userId);
  }

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  report(
    @CurrentUser() user: AuthUser,
    @Body() body: { targetType: string; targetId: string; reason: string },
  ) {
    return this.community.report(user.id, body);
  }

  @Get('moderation/reports')
  @UseGuards(JwtAuthGuard)
  reports(@CurrentUser() user: AuthUser) {
    return this.community.listReports(user.id, user.role);
  }

  @Post('moderation/users/:userId/restrict')
  @UseGuards(JwtAuthGuard)
  restrict(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() body: { muted?: boolean; hours?: number; reason?: string },
  ) {
    return this.community.restrict(user.id, user.role, userId, body);
  }
}
