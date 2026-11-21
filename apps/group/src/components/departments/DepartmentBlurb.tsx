'use client';

import { useEffect, useState } from 'react';

/** Public department description from the registry, with a local fallback. */
export function DepartmentBlurb({ department, fallback }: { department: string; fallback: string }) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/departments/${department}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { descriptionFa?: string } | null) => {
        if (!cancelled && data?.descriptionFa) setText(data.descriptionFa);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [department]);

  return <p>{text}</p>;
}
