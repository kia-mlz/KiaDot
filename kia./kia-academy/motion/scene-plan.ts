/**
 * Turns one lesson scene into a timed picture plan.
 * The plan only names tags, files, properties, and code that appear in that scene.
 */

export interface ScenePlanInput {
  title: string;
  narration: string;
  onScreenText: string;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
  durationSec: number;
}

export type SceneVisualMode = 'html' | 'css' | 'js' | 'files' | 'list' | 'theory';

export type CueMotion = 'enter' | 'wrap' | 'nest' | 'type' | 'shift' | 'grow' | 'recolor' | 'highlight';

export type CueKind = 'page' | 'tag' | 'code-line' | 'shape' | 'label' | 'step' | 'file' | 'folder' | 'value' | 'arrow';

export interface VisualCue {
  id: string;
  kind: CueKind;
  text: string;
  motion: CueMotion;
  /** When the motion starts, 0–1 across the scene. */
  at: number;
  parentId?: string;
  property?: string;
  value?: string;
}

export interface SceneVisualPlan {
  mode: SceneVisualMode;
  cues: VisualCue[];
  tags: string[];
  properties: string[];
  /** Distinct start times. Two or more means the picture changes during the scene. */
  motionCount: number;
  animated: boolean;
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const CSS_PROPS = [
  'justify-content',
  'align-items',
  'flex-direction',
  'flex-wrap',
  'background-color',
  'border-radius',
  'font-size',
  'font-weight',
  'text-align',
  'line-height',
  'box-shadow',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'z-index',
  'background',
  'display',
  'position',
  'color',
  'width',
  'height',
  'margin',
  'padding',
  'border',
  'opacity',
  'gap',
  'flex',
  'top',
  'left',
  'right',
  'bottom',
  'float',
  'clear',
  'overflow',
  'transform',
  'visibility',
];

interface ScannedTag {
  name: string;
  selfClosing: boolean;
  attributes: string;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trim()}…`;
}

function conceptLabel(input: ScenePlanInput): string {
  const screen = input.onScreenText.replace(/\s+/g, ' ').trim();
  const title = input.title.replace(/\s+/g, ' ').trim();
  if (screen && screen.length <= 42) return screen;
  return clip(title || screen, 42);
}

/** Lesson playground fences store JSON. The picture uses the html/css/js inside, not the wrapper. */
export function displayCode(code: string, language: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  const looksJson = language === 'kia-playground' || (trimmed.startsWith('{') && trimmed.endsWith('}'));
  if (!looksJson) return code;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const html = typeof parsed.html === 'string' ? parsed.html : '';
    const css = typeof parsed.css === 'string' ? parsed.css : '';
    const js =
      typeof parsed.js === 'string' ? parsed.js : typeof parsed.javascript === 'string' ? parsed.javascript : '';
    const joined = [html, css, js].filter((part) => part.trim()).join('\n');
    return joined.trim() ? joined : code;
  } catch {
    return code;
  }
}

function prettifyMarkup(source: string): string {
  if (!source.includes('<')) return source;
  return source
    .replace(/></g, '>\n<')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function scanTags(text: string): ScannedTag[] {
  const found: ScannedTag[] = [];
  const re = /<!DOCTYPE\s+html\s*>|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (/^<!DOCTYPE/i.test(match[0])) {
      found.push({ name: '!doctype', selfClosing: true, attributes: '' });
      continue;
    }
    if (match[1]) {
      found.push({ name: `/${match[1].toLowerCase()}`, selfClosing: false, attributes: '' });
      continue;
    }
    const name = (match[2] ?? '').toLowerCase();
    const attributes = (match[3] ?? '').replace(/\/\s*$/, '').trim();
    const selfClosing = /\/\s*$/.test(match[3] ?? '') || VOID_TAGS.has(name);
    found.push({ name, selfClosing, attributes });
  }
  return found;
}

function nestParents(scan: ScannedTag[]): Map<string, string> {
  const map = new Map<string, string>();
  const stack: string[] = [];
  for (const tag of scan) {
    if (tag.name === '!doctype') continue;
    if (tag.name.startsWith('/')) {
      const name = tag.name.slice(1);
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const parent = stack[stack.length - 1];
    if (parent && !map.has(tag.name)) map.set(tag.name, parent);
    if (!tag.selfClosing) stack.push(tag.name);
  }
  return map;
}

function firstAttribute(raw: string): string | null {
  const match = raw.match(/([^\s=/>]{1,24})\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/);
  if (!match?.[1] || !match[2]) return null;
  if (/[<>]/.test(match[1])) return null;
  return clip(`${match[1]}=${match[2]}`, 36);
}

function findProperties(text: string): { name: string; value: string | null }[] {
  const found: { name: string; value: string | null }[] = [];
  for (const name of CSS_PROPS) {
    const present = new RegExp(`(^|[^a-z-])${name}([^a-z-]|$)`, 'i');
    if (!present.test(text)) continue;
    const valueMatch = new RegExp(`${name}\\s*:\\s*([^;\\n{}]+)`, 'i').exec(text);
    const value = valueMatch?.[1]?.trim() ?? null;
    found.push({ name, value: value ? clip(value, 24) : null });
  }
  return found;
}

function findAssignments(text: string): { name: string; value: string }[] {
  const found: { name: string; value: string }[] = [];
  const assign = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = assign.exec(text))) {
    if (!match[1] || !match[2]) continue;
    found.push({ name: match[1], value: clip(match[2], 22) });
  }
  const fn = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((match = fn.exec(text))) {
    if (!match[1]) continue;
    found.push({ name: match[1], value: '()' });
  }
  return found.slice(0, 4);
}

function findFiles(text: string): string[] {
  const found: string[] = [];
  const re = /(?<![A-Za-z0-9_.-])([A-Za-z0-9_-]+\.(?:html|css|js|mjs))\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1];
    if (name && !found.includes(name)) found.push(name);
  }
  return found.slice(0, 4);
}

function findFolder(text: string): string | null {
  if (!/پوشه|folder|دایرکتوری/i.test(text)) return null;
  const paren = text.match(/\(([A-Za-z0-9_-]{2,40})\)/);
  if (paren?.[1] && !paren[1].includes('.')) return paren[1];
  return 'پوشه';
}

function findSteps(text: string): string[] {
  const steps: string[] = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(?:[-*+•▪]|\d+[.)]|[آ-ی]{1,4}[.)])\s+(.+)/);
    const body = match?.[1]?.trim();
    if (body) steps.push(clip(body, 42));
  }
  return steps.slice(0, 5);
}

function codeLinesOf(source: string): string[] {
  return source
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, 6)
    .map((line) => (line.length > 42 ? `${line.slice(0, 41)}…` : line));
}

function stamp(cues: VisualCue[]): VisualCue[] {
  const count = cues.length;
  return cues.map((cue, index) => ({
    ...cue,
    at: count <= 1 ? 0 : Math.round((index / count) * 78) / 100,
  }));
}

function finish(
  mode: SceneVisualMode,
  cues: VisualCue[],
  tags: string[],
  properties: string[],
): SceneVisualPlan {
  const stamped = stamp(cues);
  const motionCount = new Set(stamped.map((cue) => cue.at)).size;
  return {
    mode,
    cues: stamped,
    tags,
    properties,
    motionCount,
    animated: stamped.length >= 2 && motionCount >= 2,
  };
}

function labelCue(input: ScenePlanInput): VisualCue {
  return { id: 'label', kind: 'label', text: conceptLabel(input), motion: 'enter', at: 0 };
}

function lineCues(source: string): VisualCue[] {
  return codeLinesOf(source).map((text, index) => ({
    id: `code-${index}`,
    kind: 'code-line' as const,
    text,
    motion: 'type' as const,
    at: 0,
  }));
}

function motionForProperty(name: string): CueMotion {
  if (name === 'color' || name === 'background' || name === 'background-color' || name === 'border') return 'recolor';
  if (['width', 'height', 'font-size', 'padding', 'margin', 'gap', 'flex', 'border-radius', 'opacity'].includes(name)) {
    return 'grow';
  }
  if (
    ['top', 'left', 'right', 'bottom', 'position', 'justify-content', 'align-items', 'flex-direction', 'transform', 'float'].includes(
      name,
    )
  ) {
    return 'shift';
  }
  return 'highlight';
}

function htmlPlan(input: ScenePlanInput, shown: string, prose: string): SceneVisualPlan {
  const codeScan = scanTags(shown);
  const parents = nestParents(codeScan);
  const ordered = [...codeScan, ...scanTags(prose)];
  const names = new Set(ordered.filter((tag) => !tag.name.startsWith('/')).map((tag) => tag.name));
  if (names.has('html') && names.has('head') && !parents.has('head')) parents.set('head', 'html');
  if (names.has('html') && names.has('body') && !parents.has('body')) parents.set('body', 'html');

  const cues: VisualCue[] = [{ id: 'page', kind: 'page', text: '', motion: 'enter', at: 0 }];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of ordered) {
    if (tag.name.startsWith('/') || seen.has(tag.name)) continue;
    seen.add(tag.name);
    if (tags.length >= 6) break;
    tags.push(tag.name);
    const id = tag.name === '!doctype' ? 'tag-doctype' : `tag-${tag.name}`;
    const parentName = parents.get(tag.name);
    const parentId = parentName ? `tag-${parentName}` : 'page';
    const nested = Boolean(parentName);
    cues.push({
      id,
      kind: 'tag',
      text: tag.name === '!doctype' ? '<!DOCTYPE html>' : `<${tag.name}>`,
      motion: tag.name === '!doctype' ? 'type' : nested ? 'nest' : 'wrap',
      at: 0,
      parentId: tag.name === '!doctype' ? 'page' : parentId,
    });
    const attribute = firstAttribute(tag.attributes);
    if (attribute) {
      cues.push({
        id: `${id}-attr`,
        kind: 'label',
        text: attribute,
        motion: 'highlight',
        at: 0,
        parentId: id,
      });
    }
  }
  cues.push(...lineCues(prettifyMarkup(shown)));
  const label = labelCue(input);
  if (!label.text || label.text === 'kia-playground') {
    const named = cues.find((cue) => cue.kind === 'tag');
    label.text = named?.text || 'کد درس';
  }
  cues.unshift(label);
  return finish('html', cues, tags, []);
}

function cssPlan(input: ScenePlanInput, shown: string, corpus: string): SceneVisualPlan {
  const properties = findProperties(corpus);
  const cues: VisualCue[] = [labelCue(input)];
  const grow = properties.some((item) => motionForProperty(item.name) === 'grow');
  const shift = properties.some((item) => motionForProperty(item.name) === 'shift');
  const recolor = properties.some((item) => motionForProperty(item.name) === 'recolor');
  const shapeMotion: CueMotion = recolor ? 'recolor' : grow ? 'grow' : shift ? 'shift' : 'grow';
  cues.push({
    id: 'shape',
    kind: 'shape',
    text: properties[0]?.name ?? '',
    motion: shapeMotion,
    at: 0,
    property: properties[0]?.name,
    value: properties[0]?.value ?? '',
  });
  for (const property of properties.slice(0, 3)) {
    cues.push({
      id: `prop-${property.name}`,
      kind: 'label',
      text: property.value ? `${property.name}: ${property.value}` : property.name,
      motion: motionForProperty(property.name),
      at: 0,
      property: property.name,
      value: property.value ?? '',
    });
  }
  if (properties.some((item) => item.name === 'justify-content' || item.name === 'align-items' || item.name === 'flex-direction')) {
    const axis = properties.find((item) => item.name === 'flex-direction')?.value ?? '';
    cues.push({
      id: 'arrow',
      kind: 'arrow',
      text: properties.find((item) => item.name === 'align-items') && !properties.some((item) => item.name === 'justify-content')
        ? 'align-items'
        : 'justify-content',
      motion: 'shift',
      at: 0,
      value: axis,
    });
  }
  cues.push(...lineCues(shown));
  return finish(
    'css',
    cues,
    [],
    properties.map((item) => item.name),
  );
}

function jsPlan(input: ScenePlanInput, shown: string, corpus: string): SceneVisualPlan {
  const assignments = findAssignments(corpus);
  const cues: VisualCue[] = [labelCue(input)];
  assignments.forEach((item, index) => {
    cues.push({
      id: `value-${index}`,
      kind: 'value',
      text: `${item.name} = ${item.value}`,
      motion: 'shift',
      at: 0,
      property: item.name,
      value: item.value,
    });
  });
  cues.push(...lineCues(shown));
  if (cues.length < 2) {
    cues.push({ id: 'shape', kind: 'shape', text: '', motion: 'grow', at: 0 });
  }
  return finish('js', cues, [], []);
}

function filesPlan(input: ScenePlanInput, corpus: string): SceneVisualPlan {
  const files = findFiles(corpus);
  const folder = findFolder(corpus);
  const cues: VisualCue[] = [labelCue(input)];
  if (folder) {
    cues.push({ id: 'folder', kind: 'folder', text: folder, motion: 'wrap', at: 0 });
  }
  files.forEach((file, index) => {
    cues.push({
      id: `file-${index}`,
      kind: 'file',
      text: file,
      motion: 'nest',
      at: 0,
      parentId: folder ? 'folder' : undefined,
    });
  });
  return finish('files', cues, [], []);
}

function listPlan(input: ScenePlanInput, steps: string[]): SceneVisualPlan {
  const cues: VisualCue[] = [labelCue(input)];
  steps.forEach((step, index) => {
    cues.push({ id: `step-${index}`, kind: 'step', text: step, motion: 'enter', at: 0 });
  });
  return finish('list', cues, [], []);
}

function theoryPlan(input: ScenePlanInput): SceneVisualPlan {
  return finish('theory', [
    labelCue(input),
    { id: 'shape', kind: 'shape', text: '', motion: 'grow', at: 0 },
  ], [], []);
}

export function planSceneVisual(input: ScenePlanInput): SceneVisualPlan {
  const shown = displayCode(input.code, input.codeLanguage);
  const prose = [input.title, input.onScreenText, input.narration].filter(Boolean).join('\n');
  const corpus = `${prose}\n${shown}`;
  const lang = input.codeLanguage.toLowerCase();
  const tagNames = scanTags(corpus)
    .filter((tag) => !tag.name.startsWith('/'))
    .map((tag) => tag.name);
  const uniqueTags = [...new Set(tagNames)];
  const properties = findProperties(corpus);
  const assignments = findAssignments(shown || corpus);
  const files = findFiles(prose);
  const steps = findSteps(input.narration);

  const cssLang = lang === 'css';
  const jsLang = lang === 'js' || lang === 'javascript';
  if (uniqueTags.length > 0 && !cssLang && !jsLang) return htmlPlan(input, shown, prose);
  if (properties.length > 0 && (cssLang || uniqueTags.length === 0)) return cssPlan(input, shown, corpus);
  if ((jsLang || assignments.length > 0) && uniqueTags.length === 0) return jsPlan(input, shown, shown || corpus);
  if (files.length > 0) return filesPlan(input, prose);
  if (steps.length >= 2) return listPlan(input, steps);
  if (uniqueTags.length > 0) return htmlPlan(input, shown, prose);
  return theoryPlan(input);
}
