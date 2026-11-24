import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bufferedPortions,
  formatPlayerTime,
  playerKeyAction,
  ratioFromClientX,
} from './playerChrome';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('lesson player chrome', () => {
  it('formats the clock the way a player shows it', () => {
    expect(formatPlayerTime(0)).toBe('0:00');
    expect(formatPlayerTime(65)).toBe('1:05');
    expect(formatPlayerTime(3661)).toBe('1:01:01');
    expect(formatPlayerTime(Number.NaN)).toBe('0:00');
  });

  it('maps the basic player keys and ignores everything else', () => {
    expect(playerKeyAction(' ')).toEqual({ type: 'toggle' });
    expect(playerKeyAction('ArrowLeft')).toEqual({ type: 'seek', delta: -5 });
    expect(playerKeyAction('ArrowRight')).toEqual({ type: 'seek', delta: 5 });
    expect(playerKeyAction('ArrowUp')?.type).toBe('volume');
    expect(playerKeyAction('ArrowDown')?.type).toBe('volume');
    expect(playerKeyAction('f')).toEqual({ type: 'fullscreen' });
    expect(playerKeyAction('m')).toEqual({ type: 'mute' });
    expect(playerKeyAction('k')).toBeNull();
  });

  it('turns buffered ranges into portions of the film', () => {
    expect(
      bufferedPortions(
        [
          { start: 0, end: 20 },
          { start: 40, end: 50 },
        ],
        100,
      ),
    ).toEqual([
      { start: 0, end: 0.2 },
      { start: 0.4, end: 0.5 },
    ]);
    expect(bufferedPortions([{ start: 0, end: 10 }], 0)).toEqual([]);
  });

  it('reads a seek position from the pointer', () => {
    expect(ratioFromClientX(25, { left: 0, width: 100 })).toBe(0.25);
    expect(ratioFromClientX(-10, { left: 0, width: 100 })).toBe(0);
    expect(ratioFromClientX(400, { left: 0, width: 100 })).toBe(1);
  });

  it('paints the played range from the department token, not a hard-coded hex', () => {
    const player = readFileSync(path.join(HERE, 'MotionLessonPlayer.tsx'), 'utf8');
    const css = readFileSync(path.join(HERE, '../../styles/catalog-lesson.css'), 'utf8');
    const chrome = css.slice(css.indexOf('.motion-player {'));
    expect(player).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(chrome).toMatch(/\.motion-seek-played[\s\S]*?background:\s*var\(--dept, var\(--dept-academy\)\)/);
    expect(chrome).not.toMatch(/#(?:6464ff|6492ff|148165|28c793|e32b1b|ff7344|ffc864)/i);
  });
});
