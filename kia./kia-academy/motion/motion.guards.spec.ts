import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ADMIN_ACCESS_KEY, JwtAuthGuard } from '@kia./platform';
import { AdminMotionController } from './admin-motion.controller';
import { MotionController } from './motion.controller';

describe('motion studio auth', () => {
  it('requires a session for learner progress and published video reads', () => {
    const lessonGuards = Reflect.getMetadata(GUARDS_METADATA, MotionController.prototype.lesson) as unknown[];
    const progressGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      MotionController.prototype.progress,
    ) as unknown[];
    expect(lessonGuards).toContain(JwtAuthGuard);
    expect(progressGuards).toContain(JwtAuthGuard);
  });

  it('lets only course editors start a render', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminMotionController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    const requirement = Reflect.getMetadata(
      ADMIN_ACCESS_KEY,
      AdminMotionController.prototype.render,
    ) as { section: string; level: string };
    expect(requirement).toEqual({ section: 'courses', level: 'edit' });
  });
});