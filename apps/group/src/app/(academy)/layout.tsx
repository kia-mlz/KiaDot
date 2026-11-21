import { DepartmentGate } from '@/components/departments/DepartmentGate';

export default function AcademyDepartmentLayout({ children }: { children: React.ReactNode }) {
  return <DepartmentGate department="academy">{children}</DepartmentGate>;
}
