import { buildScenePreviewHtml, escapeHtml, isAllowedPreviewUrl, type PreviewScene } from './preview-html';

function scene(overrides: Partial<PreviewScene> = {}): PreviewScene {
  return {
    title: 'عنوان',
    narration: 'روایت',
    onScreenText: 'متن',
    animationType: 'split',
    code: '',
    codeLanguage: 'html',
    codeSource: 'instructor',
    ...overrides,
  };
}

const payloads = [
  '<script>alert(1)</script>',
  '</script >',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">',
  'onclick=',
  '<ScRiPt>',
];

describe('motion preview html', () => {
  it.each(payloads)('renders %j as text in every interpolated field', (payload) => {
    const html = buildScenePreviewHtml(
      scene({
        title: payload,
        narration: payload,
        onScreenText: payload,
        code: payload,
      }),
    );
    const escaped = escapeHtml(payload);
    expect(html.split(escaped).length - 1).toBe(4);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<\/script/i);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<ScRiPt');
    expect(html).not.toMatch(/<[^>]*\son[a-z]+\s*=/i);
    if (payload.includes('<')) {
      expect(html).not.toContain(payload);
    }
  });

  it('escapes ampersands before brackets so an entity cannot be smuggled', () => {
    const html = buildScenePreviewHtml(scene({ title: '&lt;script&gt;', narration: `a&b"'` }));
    expect(html).toContain('&amp;lt;script&amp;gt;');
    expect(html).toContain('a&amp;b&quot;&#39;');
    expect(html).not.toContain('&lt;script&gt;');
  });

  it('does not execute split-view lesson HTML or CSS', () => {
    const html = buildScenePreviewHtml(
      scene({
        animationType: 'split',
        codeLanguage: 'html',
        code: '<img src=x onerror=alert(1)>',
      }),
    );
    expect(html).not.toContain('<iframe');
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html).toContain('<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>');
  });
});

describe('isAllowedPreviewUrl', () => {
  it.each(['https://example.com/a', 'http://example.com/a', 'HTTP://example.com/a', '/learn/html', '/'])(
    'allows %j',
    (value) => {
      expect(isAllowedPreviewUrl(value)).toBe(true);
    },
  );

  it.each([
    '//evil.com',
    '///evil.com',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,hi',
    'DATA:text/html,<script>',
    'vbscript:msgbox(1)',
    'VBSCRIPT:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/x',
    'mailto:a@b.c',
    '',
    'learn/html',
    '/\\evil.com',
    '\\/evil.com',
    'ws://example.com',
    'https:example.com',
  ])('rejects %j', (value) => {
    expect(isAllowedPreviewUrl(value)).toBe(false);
  });
});
