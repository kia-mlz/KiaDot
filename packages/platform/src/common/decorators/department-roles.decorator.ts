import { SetMetadata } from '@nestjs/common';

export const DEPARTMENT_ROLES_KEY = 'departmentRoles';

export interface DepartmentRoleMeta {
  department: string;
  roles: string[];
}

/** Require one of `roles` in `department` (SUPER_ADMIN bypasses in the guard). */
export const DepartmentRoles = (department: string, ...roles: string[]) =>
  SetMetadata(DEPARTMENT_ROLES_KEY, { department, roles } satisfies DepartmentRoleMeta);
