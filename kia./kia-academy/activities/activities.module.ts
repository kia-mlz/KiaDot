import { Module } from '@nestjs/common';
import { AcademyActivitiesController } from './activities.controller';
import { AcademyActivitiesService } from './activities.service';

@Module({
  controllers: [AcademyActivitiesController],
  providers: [AcademyActivitiesService],
  exports: [AcademyActivitiesService],
})
export class AcademyActivitiesModule {}
