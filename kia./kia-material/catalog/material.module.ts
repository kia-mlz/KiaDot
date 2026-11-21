import { Module } from '@nestjs/common';
import { MaterialCatalogController } from './material.controller';
import { MaterialCatalogService } from './material.service';

@Module({
  controllers: [MaterialCatalogController],
  providers: [MaterialCatalogService],
  exports: [MaterialCatalogService],
})
export class MaterialCatalogModule {}
