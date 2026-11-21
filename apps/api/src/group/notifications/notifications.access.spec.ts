import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@kia./platform';
import { NotificationsController } from './notifications.controller';

describe('private dashboard API', () => {
  it('blocks guests from the notifications endpoint', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, NotificationsController.prototype.list) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
