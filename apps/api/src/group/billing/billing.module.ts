import { Module } from '@nestjs/common';
import { SiteSettingsModule } from '@kia./platform';
import { AdminModule } from '../admin/admin.module';
import { PaymentsModule } from '../commerce/payments/payments.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [SiteSettingsModule, PaymentsModule, AdminModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
