/** Pure pieces of the lesson player chrome. The colours stay in CSS brand tokens. */

export const SEEK_STEP_SEC = 5;
export const VOLUME_STEP = 0.05;
export const PLAYER_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export type PlayerKeyAction =
  | { type: 'toggle' }
  | { type: 'seek'; delta: number }
  | { type: 'volume'; delta: number }
  | { type: 'mute' }
  | { type: 'fullscreen' };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** YouTube-style clock: `m:ss`, or `h:mm:ss` once an hour is reached. */
export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const ss = String(rest).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

export function playerKeyAction(key: string): PlayerKeyAction | null {
  switch (key) {
    case ' ':
    case 'Spacebar':
      return { type: 'toggle' };
    case 'ArrowLeft':
      return { type: 'seek', delta: -SEEK_STEP_SEC };
    case 'ArrowRight':
      return { type: 'seek', delta: SEEK_STEP_SEC };
    case 'ArrowUp':
      return { type: 'volume', delta: VOLUME_STEP };
    case 'ArrowDown':
      return { type: 'volume', delta: -VOLUME_STEP };
    case 'f':
    case 'F':
      return { type: 'fullscreen' };
    case 'm':
    case 'M':
      return { type: 'mute' };
    default:
      return null;
  }
}

export interface Portion {
  start: number;
  end: number;
}

/** Buffered ranges as 0–1 portions of the duration, ready for a seek track. */
export function bufferedPortions(
  ranges: Array<{ start: number; end: number }>,
  duration: number,
): Portion[] {
  if (!(duration > 0)) return [];
  return ranges
    .map((range) => ({
      start: clamp(range.start / duration, 0, 1),
      end: clamp(range.end / duration, 0, 1),
    }))
    .filter((range) => range.end > range.start);
}

/** Pointer position along a left-to-right seek track. */
export function ratioFromClientX(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 0;
  return clamp((clientX - rect.left) / rect.width, 0, 1);
}
