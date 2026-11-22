/** How many catalog rows each enabled kind contributes before the merge. */
export const SHOWCASE_POOL = 12;

/** How many cards each public list returns. */
export const SHOWCASE_LIMIT = 6;

/** Clipped summary length, including the ellipsis when the source is longer. */
export const SUMMARY_MAX = 180;

export const SHOWCASE_KINDS = ['course', 'material', 'event', 'job'] as const;
export type ShowcaseKind = (typeof SHOWCASE_KINDS)[number];

export const SHOWCASE_DEMAND_KINDS = ['enrollments', 'views', 'signups', 'applications'] as const;
export type ShowcaseDemandKind = (typeof SHOWCASE_DEMAND_KINDS)[number];

export const SHOWCASE_DEPARTMENTS = ['academy', 'material', 'events', 'work'] as const;
export type ShowcaseDepartment = (typeof SHOWCASE_DEPARTMENTS)[number];

/** Stable public order. Community and labs are departments only — no catalog rows. */
export const DEPARTMENT_DISPLAY_ORDER = ['academy', 'events', 'material', 'work', 'community', 'labs'] as const;

export interface ShowcaseCandidate {
  kind: ShowcaseKind;
  id: string;
  title: string;
  /** Clipped primary description (or rules/category for events). */
  summary: string;
  /** Clipped English description when the catalog has one. Null otherwise. */
  descriptionEn: string | null;
  href: string;
  createdAt: Date | string;
  demand: number;
  demandKind: ShowcaseDemandKind;
  department: ShowcaseDepartment;
  comingSoon?: boolean;
}

export interface ShowcaseItem {
  kind: ShowcaseKind;
  id: string;
  title: string;
  summary: string;
  descriptionEn: string | null;
  href: string;
  createdAt: string;
  demand: number;
  demandKind: ShowcaseDemandKind;
  department: ShowcaseDepartment;
  comingSoon?: boolean;
}

export interface ShowcaseDepartmentRow {
  key: string;
  enabled: boolean;
  publishState: string;
}

function timeOf(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function demandOf(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Collapse whitespace and clip to SUMMARY_MAX characters. */
export function clipSummary(value: string | null | undefined, max = SUMMARY_MAX): string {
  const flat = (value ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const room = max - 1;
  let cut = flat.slice(0, room);
  const space = cut.lastIndexOf(' ');
  if (space >= Math.floor(room * 0.6)) cut = cut.slice(0, space);
  return `${cut.trimEnd()}…`;
}

export function dedupeByKindId<T extends { kind: string; id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function toItem(item: ShowcaseCandidate): ShowcaseItem {
  const created = item.createdAt instanceof Date ? item.createdAt : new Date(timeOf(item.createdAt));
  const row: ShowcaseItem = {
    kind: item.kind,
    id: item.id,
    title: item.title,
    summary: item.summary,
    descriptionEn: item.descriptionEn,
    href: item.href,
    createdAt: created.toISOString(),
    demand: demandOf(item.demand),
    demandKind: item.demandKind,
    department: item.department,
  };
  if (item.comingSoon) row.comingSoon = true;
  return row;
}

/**
 * Newest across kinds: createdAt descending, title ascending on a tie, then 6.
 * Drops a repeated kind+id (first occurrence wins) before the cut.
 */
export function rankNewest(candidates: readonly ShowcaseCandidate[], limit = SHOWCASE_LIMIT): ShowcaseItem[] {
  return dedupeByKindId(candidates)
    .sort((a, b) => {
      const byTime = timeOf(b.createdAt) - timeOf(a.createdAt);
      if (byTime !== 0) return byTime;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map(toItem);
}

/**
 * Higher demand: only demand > 0, demand descending, then createdAt descending, then 6.
 * A repeated kind+id is kept once, from the first occurrence.
 */
export function rankDemand(candidates: readonly ShowcaseCandidate[], limit = SHOWCASE_LIMIT): ShowcaseItem[] {
  return dedupeByKindId(candidates)
    .filter((item) => demandOf(item.demand) > 0)
    .sort((a, b) => {
      const byDemand = demandOf(b.demand) - demandOf(a.demand);
      if (byDemand !== 0) return byDemand;
      return timeOf(b.createdAt) - timeOf(a.createdAt);
    })
    .slice(0, limit)
    .map(toItem);
}

/** Enabled and published departments, in the public display order. */
export function selectShowcaseDepartments<T extends ShowcaseDepartmentRow>(rows: readonly T[]): T[] {
  const order = new Map<string, number>(DEPARTMENT_DISPLAY_ORDER.map((key, index) => [key, index]));
  return rows
    .filter((row) => row.enabled && row.publishState === 'published')
    .sort((a, b) => {
      const byOrder = (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER);
      if (byOrder !== 0) return byOrder;
      return a.key.localeCompare(b.key);
    });
}
