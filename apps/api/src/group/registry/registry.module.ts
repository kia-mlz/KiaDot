import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ContentService } from './content.service';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

@Module({
  imports: [AdminModule],
  controllers: [RegistryController],
  providers: [RegistryService, ContentService],
  exports: [RegistryService, ContentService],
})
export class RegistryModule {}
