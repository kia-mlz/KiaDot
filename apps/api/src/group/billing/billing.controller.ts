import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@kia./shared';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@kia./platform';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.billing.mine(user.id);
  }

  @Post('invoices/:id/checkout')
  @UseGuards(JwtAuthGuard)
  checkout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { code?: string }) {
    return this.billing.checkout(user.id, id, body.code);
  }

  @Post('invoices/:id/verify')
  @UseGuards(JwtAuthGuard)
  verify(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { authority?: string; status?: string },
  ) {
    return this.billing.verify(user.id, id, body.authority, body.status);
  }

  @Post('invoices/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.billing.refund(user, id, body.reason ?? '');
  }
}
