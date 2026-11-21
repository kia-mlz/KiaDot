import { DepartmentGate } from '@/components/departments/DepartmentGate';

export default function WorkDepartmentLayout({ children }: { children: React.ReactNode }) {
  return <DepartmentGate department="work">{children}</DepartmentGate>;
}
