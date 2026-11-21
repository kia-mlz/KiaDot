import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkService } from './work.service';

function serviceWith(prisma: Record<string, unknown>) {
  return new WorkService(prisma as never);
}

describe('WorkService authorization', () => {
  it('rejects a department that is disabled', async () => {
    const service = serviceWith({
      departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: false }) },
    });
    await expect(service.listJobs()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies application updates to someone who does not own the job', async () => {
    const service = serviceWith({
      departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          job: { ownerId: 'owner' },
        }),
      },
      departmentMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.updateApplication('intruder', 'LEARNER', 'app-1', 'hired'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a super admin update an application', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'app-1', status: 'hired' });
    const service = serviceWith({
      departmentRegistry: { findUnique: jest.fn().mockResolvedValue({ enabled: true }) },
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: 'app-1', job: { ownerId: 'owner' } }),
        update,
      },
    });
    await expect(service.updateApplication('admin', 'SUPER_ADMIN', 'app-1', 'hired')).resolves.toEqual({
      id: 'app-1',
      status: 'hired',
    });
    expect(update).toHaveBeenCalled();
  });
});
