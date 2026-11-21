import { ForbiddenException } from '@nestjs/common';
import { CommunityService } from './community.service';

describe('CommunityService moderation', () => {
  it('denies the report queue to a learner', async () => {
    const service = new CommunityService(
      {
        departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        departmentMembership: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      { publish: jest.fn() } as never,
    );
    await expect(service.listReports('learner', 'LEARNER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a super admin to read reports', async () => {
    const rows = [{ id: 'r1' }];
    const service = new CommunityService(
      {
        departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        communityReport: { findMany: jest.fn().mockResolvedValue(rows) },
      } as never,
      { publish: jest.fn() } as never,
    );
    await expect(service.listReports('admin', 'SUPER_ADMIN')).resolves.toEqual(rows);
  });
});
