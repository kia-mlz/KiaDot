import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminAccessGuard, RolesGuard, SiteSettingsModule } from '@kia./platform';
import { AdminMotionController } from './admin-motion.controller';
import { MotionJobRunner } from './motion-job.runner';
import { MotionController } from './motion.controller';
import { MotionService } from './motion.service';

@Module({
  imports: [
    SiteSettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MotionController, AdminMotionController],
  providers: [MotionService, MotionJobRunner, RolesGuard, AdminAccessGuard],
})
export class MotionStudioModule {}
