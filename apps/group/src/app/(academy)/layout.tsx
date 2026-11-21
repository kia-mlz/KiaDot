import { DepartmentGate } from '@/components/departments/DepartmentGate';

export const dynamic = 'force-dynamic';

export default function AcademyDepartmentLayout({ children }: { children: React.ReactNode }) {
  return <DepartmentGate department="academy">{children}</DepartmentGate>;
}
