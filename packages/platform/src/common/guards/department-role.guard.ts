import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@kia./shared';
import { DEPARTMENT_ROLES_KEY, type DepartmentRoleMeta } from '../decorators/department-roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<DepartmentRoleMeta | undefined>(
      DEPARTMENT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (user.role === 'SUPER_ADMIN') return true;

    const membership = await this.prisma.departmentMembership.findFirst({
      where: { userId: user.id, department: meta.department, role: { in: meta.roles } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
