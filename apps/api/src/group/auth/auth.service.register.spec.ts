import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

function build() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: { create: jest.fn().mockResolvedValue({ id: 't1' }) },
    refreshToken: { create: jest.fn(), deleteMany: jest.fn() },
    loginEvent: { create: jest.fn().mockResolvedValue({ id: 'l1' }) },
  };
  const service = new AuthService(
    prisma as never,
    { sign: jest.fn().mockResolvedValue('token'), signAsync: jest.fn().mockResolvedValue('token') } as never,
    { get: jest.fn().mockReturnValue('test'), getOrThrow: jest.fn().mockReturnValue('secret-secret-secret-secret') } as never,
    { sendPasswordReset: jest.fn().mockResolvedValue('skipped') } as never,
    { get: jest.fn() } as never,
    { sendOtp: jest.fn() } as never,
    { loginGate: jest.fn().mockResolvedValue(null) } as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, prisma };
}

describe('AuthService register and login', () => {
  it('registers a new email account', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u1', email: 'new@kia.academy', name: 'New' });
    await expect(
      service.register({ email: 'new@kia.academy', password: 'KiaAcademy123!', name: 'New User' }),
    ).resolves.toEqual({ id: 'u1', emailVerified: false });
  });

  it('rejects a duplicate registration', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue({ id: 'exists' });
    await expect(
      service.register({ email: 'admin@kia.academy', password: 'KiaAcademy123!', name: 'Admin' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the right password', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@kia.academy',
      name: 'A',
      role: 'LEARNER',
      passwordHash: await bcrypt.hash('KiaAcademy123!', 4),
      status: 'ACTIVE',
      profileComplete: true,
    });
    prisma.refreshToken.create.mockResolvedValue({});
    const result = await service.login({ email: 'a@kia.academy', password: 'KiaAcademy123!' });
    expect(result).toEqual(expect.objectContaining({ accessToken: 'token' }));
  });

  it('rejects a bad password login', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'missing@kia.academy', password: 'KiaAcademy123!' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
