import { planSceneVisual } from './scene-plan';
import { buildStageDocument } from './stage-html';

export { escapeHtml } from './html-escape';

export interface PreviewScene {
  title: string;
  narration: string;
  onScreenText: string;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
  durationSec?: number;
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

/** Build the admin preview from scene fields. Lesson markup is shown as text, not parsed or run. */
export function buildScenePreviewHtml(scene: PreviewScene): string {
  const durationSec = scene.durationSec && scene.durationSec > 0 ? scene.durationSec : 8;
  const plan = planSceneVisual({ ...scene, durationSec });
  return buildStageDocument(plan, { ...scene, durationSec }, { play: true, width: 1280, height: 720 });
}
