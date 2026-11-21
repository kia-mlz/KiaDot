import type { Metadata } from 'next';
import { DepartmentGate } from '@/components/departments/DepartmentGate';
import { publicPageMetadata } from '@/lib/seo';

export const metadata: Metadata = publicPageMetadata({
  title: 'استودیوی متریال',
  description:
    'استودیوی متریال کیادات — پالت رنگ، آیکون و انیمیشن برای یادگیری طراحی رابط، بدون نیاز به ثبت‌نام.',
  path: '/material',
});

export const dynamic = 'force-dynamic';

export default function MaterialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DepartmentGate department="material">
      <div className="material-page-shell">{children}</div>
    </DepartmentGate>
  );
}
