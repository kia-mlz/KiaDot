import { Module } from '@nestjs/common';
import { CommunityModule } from '@kia./kia-community';
import { LabsModule } from '@kia./kia-lab';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [CommunityModule, LabsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
