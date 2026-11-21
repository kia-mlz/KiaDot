import { ForbiddenException } from '@nestjs/common';
import { LabsService } from './labs.service';

describe('LabsService', () => {
  it('denies scoring to a learner without a labs role', async () => {
    const service = new LabsService(
      {
        departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
        departmentMembership: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      { publish: jest.fn() } as never,
    );
    await expect(service.scoreIdea('u1', 'LEARNER', 'idea', 10)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
