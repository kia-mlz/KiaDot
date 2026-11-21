import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard } from '@kia./platform';
import { LiveEventsService } from './live-events.service';

@Controller('events/live')
export class LiveEventsController {
  constructor(private readonly live: LiveEventsService) {}

  @Get()
  list() {
    return this.live.list();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.live.mine(user.id);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.live.get(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.live.create(user.id, body);
  }

  @Post(':id/tickets')
  @UseGuards(JwtAuthGuard)
  ticket(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name: string; priceIrr?: number; capacity?: number },
  ) {
    return this.live.addTicket(user.id, id, body);
  }

  @Post(':id/speakers')
  @UseGuards(JwtAuthGuard)
  speaker(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { name: string; bio?: string }) {
    return this.live.addSpeaker(user.id, id, body);
  }

  @Post(':id/agenda')
  @UseGuards(JwtAuthGuard)
  agenda(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title: string; startsAt: string; endsAt?: string },
  ) {
    return this.live.addAgenda(user.id, id, body);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  register(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { ticketTypeId?: string }) {
    return this.live.register(user.id, id, body.ticketTypeId);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.live.cancel(user.id, id);
  }

  @Post('signups/:id/approve')
  @UseGuards(JwtAuthGuard)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.live.approve(user.id, id);
  }

  @Post('check-in')
  @UseGuards(JwtAuthGuard)
  checkIn(@CurrentUser() user: AuthUser, @Body() body: { code: string }) {
    return this.live.checkIn(user.id, body.code);
  }
}
