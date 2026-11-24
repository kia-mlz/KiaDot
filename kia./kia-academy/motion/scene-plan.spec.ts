import { buildStageDocument } from './stage-html';
import { planSceneVisual, type ScenePlanInput } from './scene-plan';

function scene(overrides: Partial<ScenePlanInput> = {}): ScenePlanInput {
  return {
    title: 'صحنه',
    narration: '',
    onScreenText: 'صحنه',
    animationType: 'kinetic',
    code: '',
    codeLanguage: '',
    codeSource: 'lesson',
    durationSec: 8,
    ...overrides,
  };
}

describe('planSceneVisual', () => {
  it('draws the tags and code from the lesson span, and moves them', () => {
    const plan = planSceneVisual(
      scene({
        title: 'ساختار',
        onScreenText: 'ساختار',
        narration: 'صفحه با <!DOCTYPE html> شروع می‌شود. <html> دور <head> و <body> را می‌گیرد.',
        code: '<!DOCTYPE html>\n<html>\n<head></head>\n<body><p>سلام</p></body>\n</html>',
        codeLanguage: 'html',
        animationType: 'split',
      }),
    );

    expect(plan.mode).toBe('html');
    expect(plan.tags).toEqual(expect.arrayContaining(['!doctype', 'html', 'head', 'body', 'p']));
    expect(plan.cues.map((cue) => cue.text)).toEqual(
      expect.arrayContaining(['<!DOCTYPE html>', '<html>', '<head>', '<body>', '<p>']),
    );
    expect(plan.cues.some((cue) => cue.kind === 'code-line' && cue.text.includes('<html>'))).toBe(true);
    expect(plan.cues.find((cue) => cue.text === '<head>')?.motion).toBe('nest');
    expect(plan.cues.find((cue) => cue.text === '<head>')?.parentId).toBe('tag-html');
    expect(plan.cues.find((cue) => cue.text === '<body>')?.parentId).toBe('tag-html');
    expect(plan.animated).toBe(true);
    expect(plan.motionCount).toBeGreaterThan(1);
    expect(new Set(plan.cues.map((cue) => cue.motion)).size).toBeGreaterThan(1);
  });

  it('does not invent a tag, a file, or a property for plain prose', () => {
    const plan = planSceneVisual(
      scene({
        title: 'نظم',
        onScreenText: 'نظم',
        narration: 'بی‌نظمی از ابتدا پروژه را غیرقابل مدیریت می‌کند.',
      }),
    );

    expect(plan.mode).toBe('theory');
    expect(plan.tags).toEqual([]);
    expect(plan.properties).toEqual([]);
    expect(plan.cues.every((cue) => !cue.text.includes('<') && !cue.text.includes('html'))).toBe(true);
    expect(plan.animated).toBe(true);
    expect(plan.cues.map((cue) => cue.kind)).toEqual(expect.arrayContaining(['label', 'shape', 'icon']));
    expect(plan.cues.some((cue) => cue.kind === 'metaphor')).toBe(false);
  });

  it('ends a structure beat with a picture metaphor, not a paragraph', () => {
    const plan = planSceneVisual(
      scene({
        title: 'ساختار',
        onScreenText: 'ساختار',
        narration: 'HTML اسکلت صفحه است. ساختار را با شکل نشان بده، نه با یک کارت متن.',
      }),
    );

    expect(plan.mode).toBe('theory');
    expect(plan.cues.some((cue) => cue.kind === 'icon')).toBe(true);
    expect(plan.cues.some((cue) => cue.kind === 'metaphor' && cue.text === 'skeleton')).toBe(true);
    expect(plan.cues.find((cue) => cue.kind === 'metaphor')?.text).not.toContain('پاراگراف');
  });

  it('changes only the CSS properties the scene names', () => {
    const plan = planSceneVisual(
      scene({
        title: 'رنگ',
        onScreenText: 'color',
        narration: 'فقط رنگ این شکل عوض می‌شود.',
        code: 'p { color: #3366cc; }',
        codeLanguage: 'css',
        animationType: 'split',
      }),
    );

    expect(plan.mode).toBe('css');
    expect(plan.tags).toEqual([]);
    expect(plan.properties).toEqual(['color']);
    expect(plan.properties).not.toContain('width');
    expect(plan.cues.some((cue) => cue.motion === 'recolor' && cue.text.includes('color'))).toBe(true);
    expect(plan.animated).toBe(true);
  });

  it('shows a named file without turning the extension into a tag', () => {
    const plan = planSceneVisual(
      scene({
        title: 'اولین پروژه',
        onScreenText: 'index.html',
        narration: 'یک پوشه به نام پروژه (first_project) ساخته می‌شود.\nفایل index.html داخل آن است.',
      }),
    );

    expect(plan.mode).toBe('files');
    expect(plan.tags).toEqual([]);
    expect(plan.cues.some((cue) => cue.kind === 'folder' && cue.text === 'first_project')).toBe(true);
    expect(plan.cues.some((cue) => cue.kind === 'file' && cue.text === 'index.html' && cue.motion === 'nest')).toBe(true);
    expect(plan.cues.some((cue) => cue.text === '<html>' || cue.text === '<index>')).toBe(false);
  });

  it('moves a value the lesson assigns', () => {
    const plan = planSceneVisual(
      scene({
        title: 'متغیر',
        onScreenText: 'count',
        narration: 'یک نام برای یک مقدار.',
        code: 'const count = 1;',
        codeLanguage: 'js',
        animationType: 'code',
      }),
    );

    expect(plan.mode).toBe('js');
    expect(plan.tags).toEqual([]);
    const value = plan.cues.find((cue) => cue.kind === 'value');
    expect(value?.text).toContain('count');
    expect(value?.text).toContain('1');
    expect(value?.motion).toBe('shift');
  });
});

describe('stage document', () => {
  it('escapes lesson text, hides the paragraph, and animates the picture', () => {
    const narration = 'این پاراگراف بلند فقط روایت است و نباید روی قاب نوشته شود. <script>alert(1)</script>';
    const input = scene({
      title: 'ساختار',
      onScreenText: 'ساختار',
      narration,
      code: '<html>\n<body></body>\n</html>',
      codeLanguage: 'html',
    });
    const html = buildStageDocument(planSceneVisual(input), input, { play: true, width: 1280, height: 720 });
    const visible = html.replace(/<div class="sr-only">[\s\S]*<\/div>/, '');

    expect(visible).not.toContain('این پاراگراف بلند');
    expect(visible).not.toContain('<script');
    expect(html).toContain('این پاراگراف بلند');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;html&gt;');
    expect(html).toContain('var(--t)');
    expect(html).toContain('transform:');
    expect(html).toContain('class="mark"');
    expect(html).toContain('class="type"');
    expect(html).toContain('clip-path:');
    expect(html).toContain('class="bones"');
    expect(html).toContain('class="pop-icon"');
    expect(visible).not.toContain('radial-gradient');
    expect(html).not.toMatch(/<script/i);
    expect(html.match(/<style>/g)).toHaveLength(1);
  });
});
