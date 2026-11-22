import { editScene, insertScene, removeScene, reorderScenes, type StoryScene } from './storyboard';

function scene(id: string, sortOrder: number, narration: string): StoryScene {
  return {
    id,
    sortOrder,
    title: id,
    narration,
    narrationEn: '',
    onScreenText: id,
    durationSec: 5,
    animationType: 'kinetic',
    code: '',
    codeLanguage: '',
    codeSource: 'lesson',
    sourceStart: 0,
    sourceEnd: 1,
    sourceAnchor: id,
  };
}

describe('storyboard edits', () => {
  const scenes = [scene('a', 0, 'اول'), scene('b', 1, 'دوم'), scene('c', 2, 'سوم')];

  it('reorders by id and rewrites sortOrder', () => {
    const next = reorderScenes(scenes, ['c', 'a', 'b']);
    expect(next.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(next.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(next[0]?.narration).toBe('سوم');
  });

  it('rejects a partial order', () => {
    expect(() => reorderScenes(scenes, ['a', 'b'])).toThrow('MOTION_REORDER_LENGTH');
  });

  it('edits narration and labels instructor code', () => {
    const withCode = [{ ...scenes[0], code: 'const count = 1;' }, scenes[1], scenes[2]].filter(
      (item): item is StoryScene => Boolean(item),
    );
    const next = editScene(withCode, 'a', { narration: 'متن تازه', code: 'const edited = 2;' });
    expect(next[0]?.narration).toBe('متن تازه');
    expect(next[0]?.codeSource).toBe('instructor');
    expect(next[1]?.narration).toBe('دوم');
  });

  it('inserts and deletes without losing the other scenes', () => {
    const inserted = insertScene(scenes, scene('d', 0, 'جدید'), 1);
    expect(inserted.map((item) => item.id)).toEqual(['a', 'd', 'b', 'c']);
    const removed = removeScene(inserted, 'd');
    expect(removed.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(removed.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
  });
});
