import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ContentService } from './content.service';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';
import { ShowcaseController } from './showcase.controller';
import { ShowcaseService } from './showcase.service';

@Module({
  imports: [AdminModule],
  controllers: [RegistryController, ShowcaseController],
  providers: [RegistryService, ContentService, ShowcaseService],
  exports: [RegistryService, ContentService],
})
export class RegistryModule {}
