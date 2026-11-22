export interface TimedCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface SceneTimingInput {
  durationSec: number;
  narration: string;
  narrationEn?: string;
}

export function sceneTimeline(scenes: SceneTimingInput[]): { startSec: number; endSec: number; fa: string; en: string }[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const duration = Math.max(0.5, scene.durationSec);
    const startSec = cursor;
    const endSec = cursor + duration;
    cursor = endSec;
    return {
      startSec,
      endSec,
      fa: scene.narration.trim(),
      en: (scene.narrationEn ?? '').trim(),
    };
  });
}

export function cuesForLocale(
  timeline: { startSec: number; endSec: number; fa: string; en: string }[],
  locale: 'fa' | 'en',
): TimedCue[] {
  return timeline
    .map((row) => ({
      startSec: row.startSec,
      endSec: row.endSec,
      text: locale === 'fa' ? row.fa : row.en,
    }))
    .filter((cue) => cue.text.length > 0 && cue.endSec > cue.startSec);
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export function formatTimestamp(seconds: number, separator: '.' | ','): string {
  const safe = Math.max(0, seconds);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${pad(millis, 3)}`;
}

function cueText(text: string, locale: 'fa' | 'en'): string {
  const flat = text.replace(/\r/g, '').trim();
  if (locale === 'fa') return `\u200F${flat}`;
  return flat;
}

export function formatVtt(cues: TimedCue[], locale: 'fa' | 'en' = 'fa'): string {
  const lines = ['WEBVTT', ''];
  for (const cue of cues) {
    const settings = locale === 'fa' ? ' align:right' : '';
    lines.push(
      `${formatTimestamp(cue.startSec, '.')} --> ${formatTimestamp(cue.endSec, '.')}${settings}`,
    );
    lines.push(cueText(cue.text, locale));
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

export function formatSrt(cues: TimedCue[], locale: 'fa' | 'en' = 'fa'): string {
  const lines: string[] = [];
  cues.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatTimestamp(cue.startSec, ',')} --> ${formatTimestamp(cue.endSec, ',')}`);
    lines.push(cueText(cue.text, locale));
    lines.push('');
  });
  return `${lines.join('\n').trim()}\n`;
}

export function buildSubtitleTracks(scenes: SceneTimingInput[]): {
  faVtt: string;
  enVtt: string;
  faSrt: string;
  enSrt: string;
} {
  const timeline = sceneTimeline(scenes);
  const fa = cuesForLocale(timeline, 'fa');
  const en = cuesForLocale(timeline, 'en');
  return {
    faVtt: formatVtt(fa, 'fa'),
    enVtt: formatVtt(en, 'en'),
    faSrt: formatSrt(fa, 'fa'),
    enSrt: formatSrt(en, 'en'),
  };
}
