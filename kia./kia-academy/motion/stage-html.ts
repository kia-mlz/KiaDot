import { BRAND_COLORS, DARK_INK, readableInk } from '@kia./brand';
import { escapeHtml } from './html-escape';
import type { SceneVisualPlan, VisualCue } from './scene-plan';

/**
 * Paper and ink are the documented app scale (`--ink-0`, `--ink-50`, `--ink-200`,
 * `--ink-500`, `--ink-950` / `DARK_INK`). Department colour comes only from
 * `@kia./brand`.
 */
const PAPER = '#F5F6FB';
const CARD = '#FFFFFF';
const LINE = '#D6DAE9';
const MUTED = '#626C8C';

export interface StageSceneText {
  title: string;
  narration: string;
  onScreenText: string;
  code: string;
  codeSource: string;
  durationSec: number;
}

export interface StageOptions {
  /** CSS animation of `--t` for the sandboxed admin preview. Render sets `--t` per frame. */
  play: boolean;
  width: number;
  height: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function rgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function mixHex(a: string, b: string, t: number): string {
  const from = rgb(a);
  const to = rgb(b);
  const channel = (left: number, right: number) => Math.round(left * (1 - t) + right * t);
  return `#${[channel(from.r, to.r), channel(from.g, to.g), channel(from.b, to.b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

function safeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v) || /^#[0-9a-f]{6}$/.test(v)) return v;
  const named = new Set([
    'black',
    'white',
    'red',
    'blue',
    'green',
    'yellow',
    'orange',
    'purple',
    'gray',
    'grey',
    'teal',
    'navy',
    'pink',
    'brown',
    'transparent',
  ]);
  return named.has(v) ? v : fallback;
}

function cueOpen(cue: VisualCue, className: string, extraStyle = ''): string {
  const style = [`--at:${cue.at}`, extraStyle].filter(Boolean).join(';');
  return `<div class="${className}" style="${style}">`;
}

function fills(academy: string): { fill: string; ink: string }[] {
  return [
    { fill: CARD, ink: DARK_INK },
    { fill: mixHex(academy, CARD, 0.62), ink: DARK_INK },
    { fill: academy, ink: readableInk(academy) },
    { fill: mixHex(academy, DARK_INK, 0.28), ink: CARD },
  ];
}

function colorizeLine(line: string): string {
  const tag = line.match(/^(<\/?[a-zA-Z!][^>]*>)(.*)$/);
  if (tag?.[1]) {
    return `<span class="tok-tag">${escapeHtml(tag[1])}</span>${escapeHtml(tag[2] ?? '')}`;
  }
  const prop = line.match(/^(\s*)([a-zA-Z-]+)(\s*:\s*)([^;]*)(;?)$/);
  if (prop) {
    return `${escapeHtml(prop[1] ?? '')}<span class="tok-prop">${escapeHtml(prop[2] ?? '')}</span>${escapeHtml(prop[3] ?? '')}<span class="tok-val">${escapeHtml(prop[4] ?? '')}</span>${escapeHtml(prop[5] ?? '')}`;
  }
  const word = line.match(/^(\s*)(const|let|var|function)(\s+)(\w+)(.*)$/);
  if (word) {
    return `${escapeHtml(word[1] ?? '')}<span class="tok-key">${escapeHtml(word[2] ?? '')}</span>${escapeHtml(word[3] ?? '')}<span class="tok-val">${escapeHtml(word[4] ?? '')}</span>${escapeHtml(word[5] ?? '')}`;
  }
  return escapeHtml(line);
}

function renderTags(cues: VisualCue[], parentId: string, palette: { fill: string; ink: string }[], depth: number): string {
  const nodes = cues.filter((cue) => cue.parentId === parentId && (cue.kind === 'tag' || cue.kind === 'label'));
  return nodes
    .map((cue, index) => {
      if (cue.kind === 'label') {
        return `${cueOpen(cue, 'attr')}<span>${escapeHtml(cue.text)}</span></div>`;
      }
      const paint = palette[(depth + index) % palette.length] ?? palette[0];
      const fill = paint?.fill ?? CARD;
      const ink = paint?.ink ?? DARK_INK;
      const nested = renderTags(cues, cue.id, palette, depth + 1);
      const role = cue.motion === 'nest' ? 'tag-box nest' : cue.motion === 'type' ? 'tag-box banner' : 'tag-box wrap';
      return `${cueOpen(cue, role, `--fill:${fill};--on:${ink}`)}<b class="tag-name" dir="ltr">${escapeHtml(cue.text)}</b>${nested}</div>`;
    })
    .join('');
}

function renderCode(cues: VisualCue[]): string {
  const lines = cues.filter((cue) => cue.kind === 'code-line');
  if (!lines.length) return '';
  const rows = lines
    .map((cue) => `${cueOpen(cue, 'code-line')}<span>${colorizeLine(cue.text)}</span></div>`)
    .join('');
  const at = lines[0]?.at ?? 0.3;
  return `<aside class="code-card" dir="ltr" style="--at:${at}">${rows}</aside>`;
}

function renderHtml(cues: VisualCue[], palette: { fill: string; ink: string }[]): string {
  const page = cues.find((cue) => cue.kind === 'page');
  const at = page?.at ?? 0;
  const inner = renderTags(cues, 'page', palette, 0);
  return `<div class="canvas"><div class="page" style="--at:${at}">${inner}</div></div>`;
}

function renderCss(cues: VisualCue[], academy: string): string {
  const shape = cues.find((cue) => cue.kind === 'shape');
  const arrow = cues.find((cue) => cue.kind === 'arrow');
  const props = cues.filter((cue) => cue.kind === 'label' && cue.id.startsWith('prop-'));
  const grow = cues.some((cue) => cue.motion === 'grow') ? 1 : 0;
  const shift = cues.some((cue) => cue.motion === 'shift') ? 1 : 0;
  const recolor = cues.some((cue) => cue.motion === 'recolor') ? 1 : 0;
  const colorCue = cues.find((cue) => cue.motion === 'recolor' && cue.value);
  const target = safeColor(colorCue?.value ?? shape?.value, academy);
  const vertical = arrow?.text === 'align-items' || /column/i.test(arrow?.value ?? '');
  const pills = props
    .map((cue) => `${cueOpen(cue, 'pill')}<span dir="ltr">${escapeHtml(cue.text)}</span></div>`)
    .join('');
  const arrowHtml = arrow
    ? `${cueOpen(arrow, vertical ? 'arrow arrow-y' : 'arrow')}<svg viewBox="0 0 140 28" aria-hidden="true"><line x1="6" y1="14" x2="112" y2="14"></line><polygon points="112,4 134,14 112,24"></polygon></svg><span dir="ltr">${escapeHtml(arrow.text)}</span></div>`
    : '';
  const shapeHtml = shape
    ? `<div class="shape" style="--at:${shape.at};--target:${target};--grow:${grow};--shift:${shift};--recolor:${recolor}"><b dir="ltr">${escapeHtml(shape.text)}</b></div>`
    : '';
  return `<div class="canvas css-canvas">${shapeHtml}${arrowHtml}<div class="pills">${pills}</div></div>`;
}

function renderJs(cues: VisualCue[]): string {
  const values = cues.filter((cue) => cue.kind === 'value');
  const rows = values
    .map((cue) => {
      const [name, ...rest] = cue.text.split('=');
      const value = rest.join('=').trim();
      return `${cueOpen(cue, 'value-row')}<b dir="ltr">${escapeHtml((name ?? '').trim())}</b><i>=</i><em dir="ltr">${escapeHtml(value)}</em></div>`;
    })
    .join('');
  return `<div class="canvas js-canvas">${rows}</div>`;
}

function renderFiles(cues: VisualCue[]): string {
  const folder = cues.find((cue) => cue.kind === 'folder');
  const files = cues.filter((cue) => cue.kind === 'file');
  const cards = files
    .map(
      (cue) =>
        `${cueOpen(cue, 'file-card')}<span class="file-fold"></span><b dir="ltr">${escapeHtml(cue.text)}</b></div>`,
    )
    .join('');
  if (!folder) return `<div class="canvas file-canvas">${cards}</div>`;
  return `<div class="canvas file-canvas">${cueOpen(folder, 'folder')}<b>${escapeHtml(folder.text)}</b><div class="file-row">${cards}</div></div></div>`;
}

function renderList(cues: VisualCue[]): string {
  const steps = cues.filter((cue) => cue.kind === 'step');
  const rows = steps
    .map(
      (cue, index) =>
        `${cueOpen(cue, 'step')}<span class="num">${index + 1}</span><b>${escapeHtml(cue.text)}</b></div>`,
    )
    .join('');
  return `<div class="canvas list-canvas">${rows}</div>`;
}

function renderTheory(cues: VisualCue[]): string {
  const shape = cues.find((cue) => cue.kind === 'shape');
  const at = shape?.at ?? 0.4;
  return `<div class="canvas theory-canvas"><div class="orb" style="--at:${at}"></div></div>`;
}

function picture(plan: SceneVisualPlan, academy: string, palette: { fill: string; ink: string }[]): string {
  switch (plan.mode) {
    case 'html':
      return renderHtml(plan.cues, palette);
    case 'css':
      return renderCss(plan.cues, academy);
    case 'js':
      return renderJs(plan.cues);
    case 'files':
      return renderFiles(plan.cues);
    case 'list':
      return renderList(plan.cues);
    default:
      return renderTheory(plan.cues);
  }
}

export function buildStageDocument(plan: SceneVisualPlan, scene: StageSceneText, options: StageOptions): string {
  const academy = BRAND_COLORS.academy;
  const onAcademy = readableInk(academy);
  const palette = fills(academy);
  const label = plan.cues.find((cue) => cue.id === 'label');
  const title = label?.text ? escapeHtml(label.text) : escapeHtml(scene.title).slice(0, 80);
  const duration = Math.max(4, Math.min(40, Math.round(scene.durationSec || 8)));
  const instructor =
    scene.code && scene.codeSource === 'instructor'
      ? '<p class="instructor">ویرایش مدرس — این کد از متن اصلی درس نیست.</p>'
      : '';
  const play = options.play ? ' play' : '';
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="${play.trim()}" style="--t:0">
<head>
<meta charset="utf-8" />
<style>
  @property --t { syntax: "<number>"; inherits: true; initial-value: 0; }
  @font-face { font-family: "Kia Naskh"; src: url("file:///usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf") format("truetype"); font-weight: 400; }
  @font-face { font-family: "Kia Naskh"; src: url("file:///usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf") format("truetype"); font-weight: 700; }
  @font-face { font-family: "Kia Sans"; src: url("file:///usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") format("truetype"); }
  @font-face { font-family: "Kia Mono"; src: url("file:///usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf") format("truetype"); }
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
  html.play { animation: motion-play ${duration}s linear infinite; }
  @keyframes motion-play { from { --t: 0; } to { --t: 1; } }
  body {
    background-color: ${PAPER};
    background-image: radial-gradient(${LINE} 1.4px, transparent 1.5px);
    background-size: 22px 22px;
    color: ${DARK_INK};
    font-family: "Noto Naskh Arabic", "Kia Naskh", "DejaVu Sans", "Kia Sans", sans-serif;
  }
  .stage { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; padding: 3.2% 4.2% 2.4%; gap: 2.2%; }
  .title-chip, .tag-box, .code-card, .shape, .folder, .file-card, .step, .value-row, .pill {
    border: 3px solid ${DARK_INK};
    box-shadow: 6px 6px 0 ${DARK_INK};
    background: ${CARD};
  }
  .title-chip {
    --p: clamp(0, (var(--t) - var(--at) + 0.2) / 0.2, 1);
    align-self: flex-start;
    margin: 0;
    padding: 0.35em 0.9em;
    border-radius: 18px;
    font-size: clamp(22px, 3.1vw, 40px);
    line-height: 1.25;
    opacity: var(--p);
    transform: translateY(calc((1 - var(--p)) * -28px));
  }
  .board { flex: 1; min-height: 0; display: flex; gap: 2.4%; align-items: stretch; }
  .code-card {
    --p: clamp(0, (var(--t) - var(--at)) / 0.16, 1);
    width: calc(var(--p) * 38%);
    min-width: 0;
    margin: 0;
    padding: calc(var(--p) * 18px) calc(var(--p) * 16px);
    border-radius: 22px;
    border-width: calc(var(--p) * 3px);
    box-shadow: calc(var(--p) * 6px) calc(var(--p) * 6px) 0 ${DARK_INK};
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    direction: ltr;
    text-align: left;
    unicode-bidi: isolate;
    opacity: var(--p);
    background: ${CARD};
  }
  .code-line {
    --p: clamp(0, (var(--t) - var(--at)) / 0.1, 1);
    opacity: var(--p);
    transform: translateX(calc((1 - var(--p)) * -24px));
    font-family: "DejaVu Sans Mono", "Kia Mono", monospace;
    font-size: clamp(14px, 1.5vw, 22px);
    line-height: 1.45;
    padding: 2px 8px;
    border-radius: 8px;
    background: color-mix(in srgb, ${academy} calc(var(--p) * 16%), transparent);
    white-space: nowrap;
  }
  .tok-tag, .tok-key { color: ${academy}; font-weight: 700; }
  .tok-prop { color: ${DARK_INK}; font-weight: 700; }
  .tok-val { color: ${mixHex(academy, DARK_INK, 0.35)}; }
  .canvas { flex: 1; min-width: 0; min-height: 0; position: relative; display: flex; }
  .page {
    --p: clamp(0, (var(--t) - var(--at)) / 0.22, 1);
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 14px;
    padding: 22px;
    border-radius: 28px;
    border: 3px dashed ${DARK_INK};
    background: color-mix(in srgb, ${CARD} 88%, transparent);
    box-shadow: 8px 8px 0 ${DARK_INK};
    opacity: var(--p);
    transform: scale(calc(0.62 + var(--p) * 0.38));
    transform-origin: 50% 45%;
  }
  .tag-box {
    --p: clamp(0, (var(--t) - var(--at)) / 0.18, 1);
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    min-height: 0;
    max-width: 100%;
    overflow: hidden;
    padding: calc(var(--p) * 12px) calc(var(--p) * 14px);
    border-width: calc(var(--p) * 3px);
    border-radius: 18px;
    background: var(--fill, ${CARD});
    color: var(--on, ${DARK_INK});
    opacity: var(--p);
    box-shadow: calc(var(--p) * 5px) calc(var(--p) * 5px) 0 ${DARK_INK};
    transform: translateY(calc((1 - var(--p)) * 64px)) scale(calc(0.55 + var(--p) * 0.45));
  }
  .tag-box.wrap { flex: 1 1 220px; max-height: calc(var(--p) * 520px); }
  .tag-box.nest { flex: 1 1 140px; max-height: calc(var(--p) * 180px); }
  .tag-box.banner { flex: 1 0 100%; max-height: calc(var(--p) * 78px); }
  .tag-name { flex: 1 0 100%; text-align: center; font-family: "DejaVu Sans Mono", "Kia Mono", monospace; font-size: clamp(16px, 2vw, 28px); }
  .attr { font-family: "DejaVu Sans Mono", "Kia Mono", monospace; font-size: 14px; opacity: var(--p, 1); }
  .attr { --p: clamp(0, (var(--t) - var(--at)) / 0.12, 1); opacity: var(--p); }
  .css-canvas, .js-canvas, .file-canvas, .list-canvas, .theory-canvas {
    align-items: center;
    justify-content: center;
    gap: 18px;
  }
  .css-canvas { flex-direction: column; }
  .shape {
    --p: clamp(0, (var(--t) - var(--at)) / 0.55, 1);
    width: calc(120px + var(--grow) * var(--p) * 200px);
    height: calc(120px + var(--grow) * var(--p) * 110px);
    border-radius: calc(24px + var(--p) * 18px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--target) calc(var(--recolor) * var(--p) * 100%), ${CARD});
    color: ${onAcademy};
    transform: translateX(calc(var(--shift) * (var(--p) * 120px - 60px)));
    font-family: "DejaVu Sans Mono", "Kia Mono", monospace;
    font-size: 22px;
  }
  .shape b { color: ${DARK_INK}; background: ${CARD}; border-radius: 999px; padding: 4px 12px; border: 2px solid ${DARK_INK}; }
  .arrow {
    --p: clamp(0, (var(--t) - var(--at)) / 0.35, 1);
    display: flex;
    align-items: center;
    gap: 10px;
    color: ${academy};
    opacity: var(--p);
    transform: scaleX(calc(0.25 + var(--p) * 0.75));
    transform-origin: right center;
  }
  .arrow svg { width: 160px; height: 32px; }
  .arrow line { stroke: currentColor; stroke-width: 6; }
  .arrow polygon { fill: currentColor; }
  .arrow-y { transform: rotate(-90deg) scaleX(calc(0.25 + var(--p) * 0.75)); }
  .arrow span, .pill { font-family: "DejaVu Sans Mono", "Kia Mono", monospace; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .pill {
    --p: clamp(0, (var(--t) - var(--at)) / 0.16, 1);
    border-radius: 999px;
    padding: 6px 12px;
    box-shadow: 3px 3px 0 ${DARK_INK};
    opacity: var(--p);
    transform: translateY(calc((1 - var(--p)) * 16px));
  }
  .js-canvas { flex-direction: column; align-items: stretch; justify-content: center; padding: 4%; }
  .value-row {
    --p: clamp(0, (var(--t) - var(--at)) / 0.22, 1);
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: 18px;
    padding: 12px 18px;
    font-family: "DejaVu Sans Mono", "Kia Mono", monospace;
    font-size: clamp(18px, 2.4vw, 32px);
    opacity: var(--p);
  }
  .value-row em {
    font-style: normal;
    background: ${academy};
    color: ${onAcademy};
    border-radius: 12px;
    padding: 4px 12px;
    transform: translateX(calc((1 - var(--p)) * 140px));
  }
  .folder {
    --p: clamp(0, (var(--t) - var(--at)) / 0.24, 1);
    width: 86%;
    min-height: 70%;
    border-radius: 28px;
    padding: 18px 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: var(--p);
    transform: scale(calc(0.7 + var(--p) * 0.3));
  }
  .folder > b { font-size: clamp(18px, 2vw, 28px); }
  .file-row, .file-canvas { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: center; }
  .file-card {
    --p: clamp(0, (var(--t) - var(--at)) / 0.2, 1);
    width: 148px;
    height: 96px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 10px;
    position: relative;
    opacity: var(--p);
    transform: translateX(calc((1 - var(--p)) * 120px));
    font-family: "DejaVu Sans Mono", "Kia Mono", monospace;
  }
  .file-fold {
    position: absolute;
    top: -3px;
    right: 18px;
    width: 36px;
    height: 14px;
    background: ${academy};
    border: 3px solid ${DARK_INK};
    border-bottom: 0;
    border-radius: 8px 8px 0 0;
  }
  .list-canvas { flex-direction: column; align-items: stretch; justify-content: center; padding: 2% 6%; gap: 12px; }
  .step {
    --p: clamp(0, (var(--t) - var(--at)) / 0.18, 1);
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: 18px;
    padding: 10px 16px;
    opacity: var(--p);
    transform: translateX(calc((1 - var(--p)) * 80px));
  }
  .num {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: ${academy};
    color: ${onAcademy};
    font-family: "DejaVu Sans", "Kia Sans", sans-serif;
    flex: none;
  }
  .theory-canvas { gap: 28px; }
  .orb {
    --p: clamp(0, (var(--t) - var(--at)) / 0.7, 1);
    width: calc(36px + var(--p) * 180px);
    height: calc(36px + var(--p) * 180px);
    border-radius: 50%;
    border: 8px solid ${academy};
    box-shadow: 8px 8px 0 ${DARK_INK};
    background: color-mix(in srgb, ${academy} calc(var(--p) * 55%), ${CARD});
  }
  .theory-canvas .title-chip { display: none; }
  .kinetic {
    font-size: clamp(36px, 6vw, 84px);
    line-height: 1.15;
    margin: 0;
    transform: scale(calc(0.55 + var(--p, 1) * 0.45));
  }
  .bar { height: 8px; border-radius: 99px; background: ${LINE}; overflow: hidden; }
  .bar > span { display: block; height: 100%; width: calc(var(--t) * 100%); background: ${academy}; }
  .instructor { margin: 0; color: ${MUTED}; font-size: 14px; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @media (max-width: 720px) {
    .board { flex-direction: column; }
    .code-card { width: 100%; max-height: 34%; }
    .title-chip { font-size: 22px; }
  }
</style>
</head>
<body>
<main class="stage">
  ${label ? cueOpen(label, 'title-chip') : '<div class="title-chip" style="--at:0">'}<span>${title}</span></div>
  ${instructor}
  <div class="board">
    ${renderCode(plan.cues)}
    ${picture(plan, academy, palette)}
  </div>
  <div class="bar" aria-hidden="true"><span></span></div>
  <div class="sr-only">
    <p class="field-title">${escapeHtml(scene.title)}</p>
    <p class="field-narration">${escapeHtml(scene.narration)}</p>
    <p class="field-screen">${escapeHtml(scene.onScreenText)}</p>
    <pre><code>${escapeHtml(scene.code)}</code></pre>
  </div>
</main>
</body>
</html>`;
}
