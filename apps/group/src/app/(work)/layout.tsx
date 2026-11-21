import { DepartmentGate } from '@/components/departments/DepartmentGate';

export const dynamic = 'force-dynamic';

export default function WorkDepartmentLayout({ children }: { children: React.ReactNode }) {
  return <DepartmentGate department="work">{children}</DepartmentGate>;
}
