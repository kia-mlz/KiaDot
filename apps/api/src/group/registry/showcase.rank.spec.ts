import {
  clipSummary,
  rankDemand,
  rankNewest,
  selectShowcaseDepartments,
  SUMMARY_MAX,
  type ShowcaseCandidate,
} from './showcase.rank';

function candidate(overrides: Partial<ShowcaseCandidate> & Pick<ShowcaseCandidate, 'id' | 'title' | 'createdAt'>): ShowcaseCandidate {
  return {
    kind: 'course',
    summary: overrides.title,
    descriptionEn: null,
    href: `/courses/${overrides.id}`,
    demand: 0,
    demandKind: 'enrollments',
    department: 'academy',
    ...overrides,
  };
}

describe('clipSummary', () => {
  it('collapses whitespace and leaves a short string intact', () => {
    expect(clipSummary('  یک   خط\nساده  ')).toBe('یک خط ساده');
    expect(clipSummary(null)).toBe('');
    expect(clipSummary(undefined)).toBe('');
  });

  it('clips to the summary limit and keeps the ellipsis inside that budget', () => {
    const source = `word ${'x'.repeat(SUMMARY_MAX)}`;
    const clipped = clipSummary(source);
    expect(clipped.endsWith('…')).toBe(true);
    expect(clipped.length).toBeLessThanOrEqual(SUMMARY_MAX);
    expect(clipped.length).toBeGreaterThan(SUMMARY_MAX / 2);
  });
});

describe('rankNewest', () => {
  it('sorts by createdAt descending and breaks ties by title', () => {
    const older = '2026-01-01T00:00:00.000Z';
    const newer = '2026-06-01T00:00:00.000Z';
    const ranked = rankNewest([
      candidate({ id: 'b', title: 'Beta', createdAt: newer }),
      candidate({ id: 'old', title: 'Old', createdAt: older }),
      candidate({ id: 'a', title: 'Alpha', createdAt: newer }),
    ]);

    expect(ranked.map((item) => item.title)).toEqual(['Alpha', 'Beta', 'Old']);
    expect(ranked[0].createdAt).toBe(newer);
  });

  it('returns at most six and does not let a duplicate consume a slot', () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      candidate({
        id: `c${index}`,
        title: `Course ${index}`,
        createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      }),
    );
    rows.push(candidate({ id: 'c6', title: 'duplicate', createdAt: '2026-12-01T00:00:00.000Z', demand: 99 }));

    const ranked = rankNewest(rows);

    expect(ranked).toHaveLength(6);
    expect(ranked.map((item) => item.id)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2', 'c1']);
    expect(ranked.filter((item) => item.id === 'c6')).toHaveLength(1);
    expect(ranked[0].demand).toBe(0);
  });

  it('keeps the same id when the kind differs', () => {
    const ranked = rankNewest([
      candidate({ id: 'same', title: 'Course', createdAt: '2026-01-01T00:00:00.000Z' }),
      candidate({
        id: 'same',
        kind: 'job',
        title: 'Job',
        createdAt: '2026-02-01T00:00:00.000Z',
        demandKind: 'applications',
        department: 'work',
        href: '/freelance',
      }),
    ]);

    expect(ranked.map((item) => `${item.kind}:${item.id}`)).toEqual(['job:same', 'course:same']);
  });
});

describe('rankDemand', () => {
  it('drops zero and negative demand, then sorts by demand and recency', () => {
    const ranked = rankDemand([
      candidate({ id: 'zero', title: 'Zero', createdAt: '2026-08-01T00:00:00.000Z', demand: 0 }),
      candidate({ id: 'neg', title: 'Neg', createdAt: '2026-08-01T00:00:00.000Z', demand: -3 }),
      candidate({ id: 'low-new', title: 'Low new', createdAt: '2026-07-02T00:00:00.000Z', demand: 2 }),
      candidate({ id: 'low-old', title: 'Low old', createdAt: '2026-07-01T00:00:00.000Z', demand: 2 }),
      candidate({ id: 'high', title: 'High', createdAt: '2026-01-01T00:00:00.000Z', demand: 5 }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual(['high', 'low-new', 'low-old']);
  });

  it('keeps input order when demand and createdAt match, and slices to six', () => {
    const when = '2026-03-01T00:00:00.000Z';
    const rows = Array.from({ length: 7 }, (_, index) =>
      candidate({
        id: `d${index}`,
        title: `Item ${index}`,
        createdAt: when,
        demand: 4,
      }),
    );
    rows.splice(1, 0, candidate({ id: 'd0', title: 'dup', createdAt: when, demand: 100 }));

    const ranked = rankDemand(rows);

    expect(ranked).toHaveLength(6);
    expect(ranked.map((item) => item.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5']);
    expect(ranked[0].demand).toBe(4);
  });
});

describe('selectShowcaseDepartments', () => {
  it('keeps enabled published departments in the public order', () => {
    const selected = selectShowcaseDepartments([
      { key: 'labs', enabled: true, publishState: 'published' },
      { key: 'academy', enabled: false, publishState: 'published' },
      { key: 'work', enabled: true, publishState: 'published' },
      { key: 'events', enabled: true, publishState: 'draft' },
      { key: 'community', enabled: true, publishState: 'published' },
      { key: 'material', enabled: true, publishState: 'published' },
      { key: 'academy', enabled: true, publishState: 'published' },
      { key: 'events', enabled: true, publishState: 'Published' },
    ]);

    expect(selected.map((row) => row.key)).toEqual(['academy', 'material', 'work', 'community', 'labs']);
  });
});
