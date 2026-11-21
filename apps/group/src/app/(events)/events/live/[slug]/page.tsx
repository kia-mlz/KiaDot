import LiveEventDetail from './LiveEventDetail';

/**
 * The Pages mirror has no seeded live event. One path satisfies
 * `output: 'export'`. The screen loads the real event in the browser.
 * Do not set `dynamicParams`: `false` 404s other slugs on `next start`,
 * and `true` is illegal with `output: 'export'`.
 */
export function generateStaticParams() {
  return [{ slug: 'demo' }];
}

export default function Page() {
  return <LiveEventDetail />;
}
