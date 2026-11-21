import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  checkDiscountCode,
  discountAmountCents,
  normalizeDiscountCode,
  type DiscountCodeRule,
  type DiscountType,
} from '@kia./shared';
import { isProductionEnv, PrismaService, SiteSettingsService } from '@kia./platform';
import type { AuthUser } from '@kia./shared';
import { PaymentProviderRegistry } from '../commerce/payments/providers/payment-provider.registry';
import { AdminAuditService } from '../admin/audit.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SiteSettingsService,
    private readonly providers: PaymentProviderRegistry,
    private readonly audit: AdminAuditService,
  ) {}

  async mine(userId: string) {
    return this.prisma.departmentInvoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkout(userId: string, invoiceId: string, code?: string) {
    const invoice = await this.owned(userId, invoiceId);
    if (invoice.status === 'paid') return { status: 'paid', provider: invoice.provider, dev: invoice.provider === 'dev' };
    if (invoice.status !== 'pending') throw new BadRequestException('Invoice cannot be paid');
    const settings = await this.settings.get();
    if (!settings.payment.enabled) throw new BadRequestException('Payments are disabled');

    let amount = invoice.amountIrr;
    let discountIrr = 0;
    let discountCode: string | null = null;
    if (code) {
      const applied = await this.priceWithCode(code, amount, `dept:${invoice.department}`);
      amount = applied.amount;
      discountIrr = applied.discountIrr;
      discountCode = applied.code;
    }

    const providerId = settings.payment.provider;
    if (providerId !== 'dev' && !this.configured(providerId, settings.payment.merchantId, settings.payment.apiKey)) {
      return {
        status: 'pending',
        configured: false,
        provider: providerId,
        dev: false,
        message: 'Payment provider is not configured',
      };
    }

    const provider = this.providers.resolve(settings.payment);
    const created = await provider.createPayment(
      {
        paymentId: invoice.id,
        amountIrr: amount,
        description: invoice.title,
        callbackUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/checkout/callback`,
        successUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/checkout/success`,
        cancelUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/checkout/cancel`,
      },
      settings.payment,
    );
    await this.prisma.departmentInvoice.update({
      where: { id: invoice.id },
      data: { provider: providerId, gatewayRef: created.gatewayRef, discountIrr, discountCode, amountIrr: amount },
    });

    if (providerId === 'dev' && created.immediateConfirm) {
      if (isProductionEnv()) {
        throw new BadRequestException('Development payment provider is not available in production');
      }
      const verified = await provider.verifyPayment(
        { paymentId: invoice.id, amountIrr: amount, gatewayRef: created.gatewayRef },
        settings.payment,
      );
      if (!verified.success) throw new BadRequestException(verified.failureReason ?? 'Payment was not confirmed');
      const paid = await this.markPaid(invoice.id, 'dev', verified.gatewayRef ?? 'dev');
      return { status: 'paid', provider: 'dev', dev: true, invoice: paid };
    }

    return {
      status: 'pending',
      configured: true,
      provider: providerId,
      dev: false,
      redirectUrl: created.redirectUrl,
    };
  }

  async verify(userId: string, invoiceId: string, authority?: string, status?: string) {
    const invoice = await this.owned(userId, invoiceId);
    if (invoice.status === 'paid') return invoice;
    const settings = await this.settings.get();
    const provider = this.providers.resolveById((invoice.provider as 'dev') || settings.payment.provider);
    const verified = await provider.verifyPayment(
      {
        paymentId: invoice.id,
        amountIrr: invoice.amountIrr,
        gatewayRef: invoice.gatewayRef,
        authority,
        status,
      },
      settings.payment,
    );
    if (!verified.success) throw new BadRequestException(verified.failureReason ?? 'Payment was not confirmed');
    if (invoice.provider !== 'dev' && String(verified.gatewayRef ?? '').includes('-sim-')) {
      throw new BadRequestException('Simulator confirmation is not accepted for this invoice');
    }
    return this.markPaid(invoice.id, invoice.provider ?? settings.payment.provider, verified.gatewayRef ?? null);
  }

  async refund(actor: AuthUser, invoiceId: string, reason: string) {
    const invoice = await this.prisma.departmentInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'paid') throw new BadRequestException('Only a paid invoice can be refunded');
    const updated = await this.prisma.departmentInvoice.update({
      where: { id: invoiceId },
      data: { status: 'refunded', refundedAt: new Date() },
    });
    await this.audit.record({
      actor,
      action: 'invoice.refund',
      section: 'payments',
      entityType: 'DepartmentInvoice',
      entityId: invoiceId,
      target: invoice.title,
      reason,
      before: { status: invoice.status },
      after: { status: 'refunded' },
    });
    return updated;
  }

  private async markPaid(id: string, provider: string | null, gatewayRef: string | null) {
    const current = await this.prisma.departmentInvoice.findUnique({ where: { id } });
    if (current?.discountCode && current.status !== 'paid') {
      await this.prisma.discountCode.updateMany({
        where: { code: current.discountCode },
        data: { usageCount: { increment: 1 } },
      });
    }
    return this.prisma.departmentInvoice.update({
      where: { id },
      data: { status: 'paid', provider, gatewayRef, paidAt: new Date() },
    });
  }

  private async owned(userId: string, id: string) {
    const invoice = await this.prisma.departmentInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.userId !== userId) throw new ForbiddenException('Insufficient permissions');
    return invoice;
  }

  private configured(provider: string, merchantId: string, apiKey: string) {
    if (provider === 'stripe') return Boolean(process.env.STRIPE_SECRET_KEY || apiKey);
    if (provider === 'zarinpal' || provider === 'idpay') return Boolean(merchantId?.trim());
    return false;
  }

  private async priceWithCode(raw: string, amount: number, slug: string) {
    const code = normalizeDiscountCode(raw);
    const row = await this.prisma.discountCode.findUnique({ where: { code } });
    if (!row) throw new BadRequestException('Discount code not found');
    const slugs = Array.isArray(row.courseSlugs) ? (row.courseSlugs as string[]) : [];
    const rule: DiscountCodeRule = {
      code: row.code,
      type: row.type as DiscountType,
      value: row.value,
      active: row.active,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      maxUses: row.maxUses,
      usedCount: row.usageCount,
      minSubtotalCents: row.minSubtotalCents,
      courseSlugs: slugs.length ? slugs : null,
    };
    const eligible = !rule.courseSlugs || rule.courseSlugs.includes(slug) ? amount : 0;
    const check = checkDiscountCode(rule, { now: new Date(), subtotalCents: amount, eligibleSubtotalCents: eligible });
    if (!check.ok) throw new BadRequestException('Discount code does not apply');
    const discountIrr = discountAmountCents(rule, eligible);
    return { amount: amount - discountIrr, discountIrr, code };
  }
}
