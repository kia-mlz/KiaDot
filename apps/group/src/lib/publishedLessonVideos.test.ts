import { describe, expect, it } from 'vitest';
import { lessonVideoSrc, publishedVideoFromManifest } from './publishedLessonVideos';

describe('published lesson videos', () => {
  it('keeps a same-origin lesson film and adds the pages base path once', () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = '/KiaDot';
    try {
      expect(lessonVideoSrc('/lesson-videos/html/html-introduction.mp4')).toBe(
        '/KiaDot/lesson-videos/html/html-introduction.mp4',
      );
      expect(lessonVideoSrc('/KiaDot/lesson-videos/html/html-introduction.mp4')).toBe(
        '/KiaDot/lesson-videos/html/html-introduction.mp4',
      );
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = previous;
    }
  });

  it('reads only committed lesson mp4 paths from the manifest', () => {
    const manifest = {
      'html/html-introduction': '/lesson-videos/html/html-introduction.mp4',
      'html/other': 'https://example.com/other.mp4',
      'html/escape': '/lesson-videos/../secret.mp4',
    };
    expect(publishedVideoFromManifest(manifest, 'html', 'html-introduction')).toBe(
      '/lesson-videos/html/html-introduction.mp4',
    );
    expect(publishedVideoFromManifest(manifest, 'html', 'other')).toBeNull();
    expect(publishedVideoFromManifest(manifest, 'html', 'escape')).toBeNull();
    expect(publishedVideoFromManifest(manifest, 'css', 'missing')).toBeNull();
  });
});
