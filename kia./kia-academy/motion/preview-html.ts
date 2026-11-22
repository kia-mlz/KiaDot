export interface PreviewScene {
  title: string;
  narration: string;
  onScreenText: string;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape every character that can open a tag or an attribute in this document. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] ?? char);
}

const PREVIEW_URL_BASE = 'https://motion-preview.invalid';

function hasControlChar(value: string): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

/**
 * Allow http(s) URLs and a same-origin path that starts with one slash.
 * The scheme is the URL parser's protocol, checked against a dummy base.
 */
export function isAllowedPreviewUrl(value: string): boolean {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw || raw.length > 2048) return false;
  if (hasControlChar(raw) || raw.includes('\\') || raw.startsWith('//')) return false;

  let parsed: URL;
  try {
    parsed = new URL(raw, PREVIEW_URL_BASE);
  } catch {
    return false;
  }

  const base = new URL(PREVIEW_URL_BASE);
  if (raw.startsWith('/')) {
    return parsed.origin === base.origin && parsed.protocol === 'https:';
  }
  if (parsed.origin === base.origin) return false;
  return parsed.protocol === 'https:' || parsed.protocol === 'http:';
}

/** Build the admin preview from scene fields. Lesson markup is shown as text, not parsed. */
export function buildScenePreviewHtml(scene: PreviewScene): string {
  const title = escapeHtml(scene.title);
  const narration = escapeHtml(scene.narration);
  const onScreen = escapeHtml(scene.onScreenText);
  const code = escapeHtml(scene.code);
  const instructor =
    scene.code && scene.codeSource === 'instructor'
      ? '<p class="label">ویرایش مدرس — این کد از متن اصلی درس نیست.</p>'
      : '';
  const codeBlock = scene.code ? `<pre><code>${code}</code></pre>` : '';
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #14161c; color: #f4f1ea; font-family: "Noto Naskh Arabic", sans-serif; }
  main { padding: 28px; display: grid; gap: 16px; }
  h1 { font-size: 28px; margin: 0; }
  .screen { font-size: 20px; }
  pre { direction: ltr; text-align: left; background: #0e1016; padding: 16px; overflow: auto; font-family: "DejaVu Sans Mono", monospace; white-space: pre-wrap; }
  .label { color: #e6c07b; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p class="screen">${onScreen}</p>
  <p>${narration}</p>
  ${instructor}
  ${codeBlock}
</main>
</body>
</html>`;
}
