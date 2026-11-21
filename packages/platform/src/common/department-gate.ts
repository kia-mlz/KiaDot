import { NotFoundException } from '@nestjs/common';

interface RegistryReader {
  departmentRegistry: {
    findUnique(args: { where: { key: string } }): Promise<{ enabled: boolean } | null>;
  };
}

/** 404 only this department when the registry marks it disabled. Missing row = enabled. */
export async function assertDepartmentEnabled(prisma: RegistryReader, key: string): Promise<void> {
  const row = await prisma.departmentRegistry.findUnique({ where: { key } });
  if (row && row.enabled === false) {
    throw new NotFoundException('Department unavailable');
  }
}
