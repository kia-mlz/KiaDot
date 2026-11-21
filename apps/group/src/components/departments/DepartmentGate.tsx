import { notFound } from 'next/navigation';

/**
 * Hide one department when the registry disables it. A failed lookup stays open.
 *
 * The GitHub Pages mirror is `output: 'export'` and has no API. Skip the
 * lookup there. `cache: 'no-store'` (or `dynamic = 'force-dynamic'` on a
 * parent layout) cannot be used while those play routes are pre-rendered.
 */
export async function DepartmentGate({
  department,
  children,
}: {
  department: string;
  children: React.ReactNode;
}) {
  if (process.env.GITHUB_PAGES === 'true') return children;

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
