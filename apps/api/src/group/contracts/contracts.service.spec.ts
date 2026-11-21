import { ContractsService } from './contracts.service';

describe('ContractsService certificate visibility', () => {
  it('returns academy certificates on a published work profile', async () => {
    const prisma = {
      specialistProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          published: true,
          reviews: [],
          user: { id: 'u1', name: 'Alex', avatarUrl: null },
        }),
      },
      userSkill: { findMany: jest.fn().mockResolvedValue([{ name: 'TypeScript' }]) },
      certificate: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', code: 'abc', course: { title: 'HTML', slug: 'html' } }]),
      },
    };
    const service = new ContractsService(prisma as never, {} as never, {} as never);
    const result = await service.workProfile('u1');
    expect(result.certificates).toHaveLength(1);
    expect(result.skills[0]?.name).toBe('TypeScript');
    expect(prisma.certificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });
});
