export interface StoryScene {
  id: string;
  sortOrder: number;
  title: string;
  narration: string;
  narrationEn: string;
  onScreenText: string;
  durationSec: number;
  animationType: string;
  code: string;
  codeLanguage: string;
  codeSource: string;
  sourceStart: number;
  sourceEnd: number;
  sourceAnchor: string;
}

export class StoryboardError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function reorderScenes<T extends { id: string }>(scenes: T[], orderedIds: string[]): T[] {
  if (orderedIds.length !== scenes.length) {
    throw new StoryboardError('MOTION_REORDER_LENGTH');
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new StoryboardError('MOTION_REORDER_DUP');
  }
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  return orderedIds.map((id, index) => {
    const scene = byId.get(id);
    if (!scene) throw new StoryboardError('MOTION_REORDER_UNKNOWN');
    return { ...scene, sortOrder: index };
  });
}

export function editScene<T extends { id: string; code?: string; codeSource?: string }>(
  scenes: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  const index = scenes.findIndex((scene) => scene.id === id);
  if (index < 0) throw new StoryboardError('MOTION_SCENE_MISSING');
  const current = scenes[index];
  if (!current) throw new StoryboardError('MOTION_SCENE_MISSING');
  const next = { ...current, ...patch, id: current.id };
  if (typeof patch.code === 'string' && patch.code !== current.code) {
    (next as { codeSource?: string }).codeSource = 'instructor';
  }
  return scenes.map((scene, sceneIndex) => (sceneIndex === index ? next : scene));
}

export function removeScene<T extends { id: string }>(scenes: T[], id: string): T[] {
  const next = scenes.filter((scene) => scene.id !== id);
  if (next.length === scenes.length) throw new StoryboardError('MOTION_SCENE_MISSING');
  return next.map((scene, index) => ({ ...scene, sortOrder: index }));
}

export function insertScene<T extends { id: string; sortOrder?: number }>(
  scenes: T[],
  scene: T,
  index?: number,
): T[] {
  const at = index === undefined ? scenes.length : Math.max(0, Math.min(scenes.length, index));
  const next = [...scenes.slice(0, at), scene, ...scenes.slice(at)];
  return next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex }));
}
