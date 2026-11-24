import { BRAND_COLORS, DARK_INK, readableInk } from '@kia./brand';
import { escapeHtml } from './html-escape';
import type { SceneVisualPlan, VisualCue } from './scene-plan';

/**
 * Ink is the documented app scale (`DARK_INK` and the paper mixes). The film
 * field is white mixed with the Academy token from `@kia./brand`.
 */
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

function outlineSvg(name: string): string {
  const stroke =
    'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  switch (name) {
    case 'folder':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><path d="M8 16h10l4 4h18v18H8z"/></svg>`;
    case 'file':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><path d="M14 6h14l10 10v26H14z"/><path d="M28 6v10h10"/></svg>`;
    case 'brackets':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><path d="M18 10 8 24l10 14M30 10l10 14-10 14"/></svg>`;
    case 'page':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><rect x="10" y="6" width="28" height="36" rx="3"/><path d="M16 16h16M16 24h16M16 32h10"/></svg>`;
    case 'square':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><rect x="10" y="10" width="28" height="28" rx="4"/></svg>`;
    case 'triangle':
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><path d="M24 8 42 40H6z"/></svg>`;
    default:
      return `<svg viewBox="0 0 48 48" aria-hidden="true" ${stroke}><circle cx="24" cy="24" r="12"/></svg>`;
  }
}

function renderIcon(cue: VisualCue): string {
  return `${cueOpen(cue, 'pop-icon')}${outlineSvg(cue.text)}</div>`;
}

function iconRow(cues: VisualCue[]): string {
  const icons = cues.filter((cue) => cue.kind === 'icon');
  if (!icons.length) return '';
  return `<div class="icon-row">${icons.map(renderIcon).join('')}</div>`;
}

/** Page blocks beside a drawn skeleton. No lesson paragraph is placed here. */
function renderMetaphor(cue: VisualCue): string {
  return `${cueOpen(cue, 'metaphor')}<div class="page-stack" aria-hidden="true"><span></span><span></span><span></span></div><svg class="bones" viewBox="0 0 80 140" aria-hidden="true"><circle cx="40" cy="16" r="10"/><path d="M40 26v52M16 48h48M40 78 22 118M40 78l18 40"/></svg></div>`;
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
  const metaphor = cues.find((cue) => cue.kind === 'metaphor');
  return `<div class="canvas"><div class="page" style="--at:${at}">${inner}</div>${iconRow(cues)}${metaphor ? renderMetaphor(metaphor) : ''}</div>`;
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
  return `<div class="canvas css-canvas">${shapeHtml}${arrowHtml}${iconRow(cues)}<div class="pills">${pills}</div></div>`;
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
  return `<div class="canvas js-canvas">${iconRow(cues)}${rows}</div>`;
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
  const metaphor = cues.find((cue) => cue.kind === 'metaphor');
  const extra = `${iconRow(cues)}${metaphor ? renderMetaphor(metaphor) : ''}`;
  if (!folder) return `<div class="canvas file-canvas">${cards}${extra}</div>`;
  return `<div class="canvas file-canvas">${cueOpen(folder, 'folder')}<b>${escapeHtml(folder.text)}</b><div class="file-row">${cards}</div></div>${extra}</div>`;
}

function renderList(cues: VisualCue[]): string {
  const steps = cues.filter((cue) => cue.kind === 'step');
  const rows = steps
    .map(
      (cue, index) =>
        `${cueOpen(cue, 'step')}<span class="num">${index + 1}</span><b>${escapeHtml(cue.text)}</b></div>`,
    )
    .join('');
  const metaphor = cues.find((cue) => cue.kind === 'metaphor');
  return `<div class="canvas list-canvas">${rows}${iconRow(cues)}${metaphor ? renderMetaphor(metaphor) : ''}</div>`;
}

function renderTheory(cues: VisualCue[]): string {
  const slabs = [0.06, 0.16, 0.26]
    .map((at, index) => `<span class="slab" style="--at:${at};width:${128 + index * 40}px"></span>`)
    .join('');
  const metaphor = cues.find((cue) => cue.kind === 'metaphor');
  return `<div class="canvas theory-canvas"><div class="stack">${slabs}</div>${iconRow(cues)}${metaphor ? renderMetaphor(metaphor) : ''}</div>`;
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
  const field = mixHex('#ffffff', academy, 0.16);
  const fieldDeep = mixHex('#ffffff', academy, 0.38);
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
    background: ${field};
    color: ${DARK_INK};
    font-family: "Noto Naskh Arabic", "Kia Naskh", "DejaVu Sans", "Kia Sans", sans-serif;
  }
  .stage { position: relative; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; padding: 4.2% 4.6% 3%; gap: 2%; }
  .mark {
    position: absolute;
    top: 5%;
    left: 4.2%;
    width: 46px;
    height: 46px;
    border: 3px solid ${academy};
    background: ${fieldDeep};
    border-radius: calc(8px + var(--t) * 24px);
    transform: rotate(calc(var(--t) * 70deg)) scale(calc(0.78 + var(--t) * 0.34));
  }
  .type {
    --p: clamp(0, var(--t) / 0.16, 1);
    display: inline-block;
    max-width: 16ch;
    overflow: hidden;
    white-space: nowrap;
    font-size: clamp(32px, 4.6vw, 68px);
    font-weight: 700;
    line-height: 1.15;
    clip-path: inset(0 0 0 calc((1 - var(--p)) * 100%));
  }
  .pop-icon {
    --p: clamp(0, (var(--t) - var(--at)) / 0.08, 1);
    width: 76px;
    height: 76px;
    color: ${academy};
    opacity: var(--p);
    transform: scale(calc(0.35 + var(--p) * 0.75));
  }
  .pop-icon svg { width: 100%; height: 100%; display: block; }
  .icon-row { display: flex; align-items: center; justify-content: center; gap: 18px; }
  .metaphor {
    --p: clamp(0, (var(--t) - var(--at)) / 0.14, 1);
    display: flex;
    align-items: flex-end;
    gap: 28px;
    opacity: var(--p);
    transform: translateY(calc((1 - var(--p)) * 18px));
  }
  .page-stack { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .page-stack span {
    display: block;
    height: 22px;
    border: 3px solid ${academy};
    border-radius: 8px;
    background: ${fieldDeep};
  }
  .page-stack span:nth-child(1) { width: 118px; }
  .page-stack span:nth-child(2) { width: 168px; }
  .page-stack span:nth-child(3) { width: 92px; }
  .bones {
    width: 64px;
    height: 108px;
    fill: none;
    stroke: ${academy};
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 240;
    stroke-dashoffset: calc((1 - var(--p)) * 240);
  }
  .stack { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .slab {
    --p: clamp(0, (var(--t) - var(--at)) / 0.1, 1);
    display: block;
    height: 28px;
    border: 3px solid ${academy};
    border-radius: 10px;
    background: ${fieldDeep};
    opacity: var(--p);
    transform: scaleX(calc(0.25 + var(--p) * 0.75));
    transform-origin: right center;
  }
  .tag-box, .code-card, .shape, .folder, .file-card, .step, .value-row, .pill {
    border: 2px solid ${academy};
    background: ${CARD};
  }
  .board { flex: 1; min-height: 0; display: flex; gap: 2.4%; align-items: stretch; }
  .code-card {
    --p: clamp(0, (var(--t) - var(--at)) / 0.16, 1);
    width: calc(var(--p) * 38%);
    min-width: 0;
    margin: 0;
    padding: calc(var(--p) * 18px) calc(var(--p) * 16px);
    border-radius: 22px;
    border-width: calc(var(--p) * 2px);
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
    --p: clamp(0, (var(--t) - var(--at)) / 0.14, 1);
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 14px;
    padding: 22px;
    border-radius: 28px;
    border: 3px solid ${academy};
    background: color-mix(in srgb, ${CARD} 72%, ${field});
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
    transform: translateY(calc((1 - var(--p)) * 36px)) scale(calc(0.6 + var(--p) * 0.4));
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
    --p: clamp(0, (var(--t) - var(--at)) / 0.2, 1);
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
    --p: clamp(0, (var(--t) - var(--at)) / 0.14, 1);
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
    --p: clamp(0, (var(--t) - var(--at)) / 0.12, 1);
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
    --p: clamp(0, (var(--t) - var(--at)) / 0.14, 1);
    width: 92%;
    max-height: 46%;
    flex: 0 1 auto;
    border-radius: 28px;
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    opacity: var(--p);
    transform: scale(calc(0.86 + var(--p) * 0.14));
  }
  .folder > b { font-size: clamp(18px, 2vw, 28px); }
  .file-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: center; }
  .file-canvas { flex-direction: column; flex-wrap: nowrap; justify-content: space-evenly; overflow: hidden; }
  .file-card {
    --p: clamp(0, (var(--t) - var(--at)) / 0.12, 1);
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
  .list-canvas { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; padding: 2% 4%; gap: 16px; }
  .step {
    --p: clamp(0, (var(--t) - var(--at)) / 0.1, 1);
    width: 148px;
    min-height: 148px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 28px;
    padding: 12px;
    text-align: center;
    opacity: var(--p);
    transform: translateY(calc((1 - var(--p)) * 28px)) scale(calc(0.7 + var(--p) * 0.3));
  }
  .step b { font-size: 16px; line-height: 1.3; font-weight: 700; }
  .num {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: ${academy};
    color: ${onAcademy};
    font-family: "DejaVu Sans", "Kia Sans", sans-serif;
    font-size: 22px;
    flex: none;
  }
  .theory-canvas, .file-canvas { gap: 22px; }
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
    .type { font-size: 28px; }
  }
</style>
</head>
<body>
<main class="stage">
  <div class="mark" aria-hidden="true"></div>
  ${label ? cueOpen(label, 'label-row') : '<div class="label-row" style="--at:0">'}<span class="type">${title}</span></div>
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
