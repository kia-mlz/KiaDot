export interface PreviewScene {
  title: string;
  narration: string;
  onScreenText: string;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip active content from instructor HTML before it is placed in a sandboxed iframe. */
export function neutralizeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function buildScenePreviewHtml(scene: PreviewScene): string {
  const title = escapeHtml(scene.title);
  const narration = escapeHtml(scene.narration);
  const onScreen = escapeHtml(scene.onScreenText);
  const code = escapeHtml(scene.code);
  const instructor =
    scene.code && scene.codeSource === 'instructor'
      ? '<p class="label">ویرایش مدرس — این کد از متن اصلی درس نیست.</p>'
      : '';
  const lang = scene.codeLanguage.toLowerCase();
  const split =
    scene.animationType === 'split' && (lang === 'html' || lang === 'css' || lang === 'svg')
      ? `<iframe sandbox srcdoc="${escapeHtml(splitDocument(scene))}" title="preview"></iframe>`
      : '';
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #14161c; color: #f4f1ea; font-family: "Noto Naskh Arabic", sans-serif; }
  main { padding: 28px; display: grid; gap: 16px; }
  h1 { font-size: 28px; margin: 0; }
  .screen { font-size: 20px; }
  pre { direction: ltr; text-align: left; background: #0e1016; padding: 16px; overflow: auto; font-family: "DejaVu Sans Mono", monospace; }
  .label { color: #e6c07b; }
  iframe { width: 100%; height: 220px; border: 0; background: white; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p class="screen">${onScreen}</p>
  <p>${narration}</p>
  ${instructor}
  ${code ? `<pre><code>${code}</code></pre>` : ''}
  ${split}
</main>
</body>
</html>`;
}

function splitDocument(scene: PreviewScene): string {
  const lang = scene.codeLanguage.toLowerCase();
  if (lang === 'css') {
    return `<!DOCTYPE html><html><head><style>${neutralizeHtml(scene.code)}</style></head><body><p>نمونه</p></body></html>`;
  }
  return `<!DOCTYPE html><html><body>${neutralizeHtml(scene.code)}</body></html>`;
}
