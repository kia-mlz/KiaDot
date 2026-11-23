import { join } from 'path';
import { publishedLessonVideoPath } from './storage';

describe('published lesson video path', () => {
  it('builds a public film path from the lesson slug', () => {
    expect(publishedLessonVideoPath('/site/public', 'html', 'html-introduction')).toBe(
      join('/site/public', 'lesson-videos', 'html', 'html-introduction.mp4'),
    );
  });

  it('refuses a path that leaves the lesson-videos folder', () => {
    expect(publishedLessonVideoPath('/site/public', '..', 'html-introduction')).toBeNull();
    expect(publishedLessonVideoPath('/site/public', 'html', '../secret')).toBeNull();
  });
});
