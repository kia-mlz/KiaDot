'use client';

import { useMemo } from 'react';
import { markdownToHtml } from '@/lib/markdown';

export interface SyncScene {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  startSec: number;
}

export function splitLessonByScenes(content: string, scenes: SyncScene[]) {
  const usable = scenes
    .filter(
      (scene) =>
        scene.sourceEnd > scene.sourceStart &&
        scene.sourceStart >= 0 &&
        scene.sourceEnd <= content.length,
    )
    .sort((a, b) => a.sourceStart - b.sourceStart);
  const pieces: { key: string; text: string; scene: SyncScene | null }[] = [];
  let cursor = 0;
  for (const scene of usable) {
    if (scene.sourceStart < cursor) continue;
    if (scene.sourceStart > cursor) {
      pieces.push({
        key: `gap-${cursor}`,
        text: content.slice(cursor, scene.sourceStart),
        scene: null,
      });
    }
    pieces.push({
      key: scene.id,
      text: content.slice(scene.sourceStart, scene.sourceEnd),
      scene,
    });
    cursor = scene.sourceEnd;
  }
  if (cursor < content.length) {
    pieces.push({ key: `tail-${cursor}`, text: content.slice(cursor), scene: null });
  }
  return pieces.filter((piece) => piece.text.length > 0);
}

export function SyncedLessonBody({
  content,
  scenes,
  activeSceneId,
  onSeek,
}: {
  content: string;
  scenes: SyncScene[];
  activeSceneId: string | null;
  onSeek: (seconds: number) => void;
}) {
  const pieces = useMemo(() => splitLessonByScenes(content, scenes), [content, scenes]);
  return (
    <div className="lesson-description lesson-md">
      {pieces.map((piece) => {
        const html = markdownToHtml(piece.text);
        if (!piece.scene) {
          return <div key={piece.key} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        const scene = piece.scene;
        const active = scene.id === activeSceneId;
        return (
          <div
            key={piece.key}
            role="button"
            tabIndex={0}
            className={`lesson-motion-span${active ? ' is-active' : ''}`}
            onClick={() => onSeek(scene.startSec)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSeek(scene.startSec);
              }
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
    </div>
  );
}
