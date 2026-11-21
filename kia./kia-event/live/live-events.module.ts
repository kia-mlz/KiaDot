import { Module } from '@nestjs/common';
import { LiveEventsController } from './live-events.controller';
import { LiveEventsService } from './live-events.service';

@Module({
  controllers: [LiveEventsController],
  providers: [LiveEventsService],
  exports: [LiveEventsService],
})
export class LiveEventsModule {}
