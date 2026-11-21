import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import {
  ApplyJobDto,
  ApplicationStatusDto,
  CreateJobDto,
  CreateProjectDto,
  HireDto,
  MilestoneDto,
  ProposalDto,
  ReviewDto,
  UpsertProfileDto,
} from './dto';
import { WorkService } from './work.service';

@Controller('work')
export class WorkController {
  constructor(private readonly work: WorkService) {}

  @Get('jobs')
  listJobs(@Query('category') category?: string) {
    return this.work.listJobs(category);
  }

  @Post('jobs')
  @UseGuards(JwtAuthGuard)
  createJob(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto) {
    return this.work.createJob(user.id, dto);
  }

  @Post('jobs/:id/apply')
  @UseGuards(JwtAuthGuard)
  apply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApplyJobDto) {
    return this.work.apply(user.id, id, dto.cover);
  }

  @Patch('applications/:id')
  @UseGuards(JwtAuthGuard)
  updateApplication(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApplicationStatusDto,
  ) {
    return this.work.updateApplication(user.id, user.role, id, dto.status);
  }

  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  myProfile(@CurrentUser() user: AuthUser) {
    return this.work.myProfile(user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertProfileDto) {
    return this.work.upsertProfile(user.id, dto);
  }

  @Put('skills')
  @UseGuards(JwtAuthGuard)
  skills(@CurrentUser() user: AuthUser, @Body() body: { skills?: string[] }) {
    return this.work.setSkills(user.id, Array.isArray(body.skills) ? body.skills : []);
  }

  @Get('profiles/:userId')
  publicProfile(@Param('userId') userId: string) {
    return this.work.publicProfile(userId);
  }

  @Get('projects')
  listProjects() {
    return this.work.listProjects();
  }

  @Post('projects')
  @UseGuards(JwtAuthGuard)
  createProject(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.work.createProject(user.id, dto);
  }

  @Post('projects/:id/proposals')
  @UseGuards(JwtAuthGuard)
  propose(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProposalDto) {
    return this.work.propose(user.id, id, dto);
  }

  @Post('projects/:id/hire')
  @UseGuards(JwtAuthGuard)
  hire(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HireDto) {
    return this.work.hire(user.id, id, dto.proposalId);
  }

  @Post('projects/:id/milestones')
  @UseGuards(JwtAuthGuard)
  milestone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MilestoneDto) {
    return this.work.addMilestone(user.id, id, dto);
  }

  @Post('milestones/:id/deliver')
  @UseGuards(JwtAuthGuard)
  deliver(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.work.setMilestone(user.id, id, 'delivered');
  }

  @Post('milestones/:id/accept')
  @UseGuards(JwtAuthGuard)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.work.setMilestone(user.id, id, 'accepted');
  }

  @Post('milestones/:id/revision')
  @UseGuards(JwtAuthGuard)
  revision(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.work.setMilestone(user.id, id, 'revision');
  }

  @Post('milestones/:id/invoice')
  @UseGuards(JwtAuthGuard)
  invoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.work.invoiceMilestone(user.id, id);
  }

  @Post('profiles/:userId/reviews')
  @UseGuards(JwtAuthGuard)
  review(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body() dto: ReviewDto) {
    return this.work.review(user.id, userId, dto);
  }
}
