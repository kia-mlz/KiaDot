import { notFound } from 'next/navigation';

/** Hide one department when the registry disables it. A failed lookup stays open. */
export async function DepartmentGate({
  department,
  children,
}: {
  department: string;
  children: React.ReactNode;
}) {
  const base = (process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/departments/${department}`, { cache: 'no-store' });
    if (res.ok) {
      const body = (await res.json()) as { enabled?: boolean };
      if (body.enabled === false) notFound();
    }
  } catch {
    // Registry unreachable: do not take the department down.
  }
  return children;
}
