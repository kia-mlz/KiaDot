import { buildSubtitleTracks, formatTimestamp, sceneTimeline } from './subtitles';

describe('subtitles', () => {
  const scenes = [
    { durationSec: 4, narration: 'سلام', narrationEn: 'Hello' },
    { durationSec: 6, narration: 'ادامه', narrationEn: '' },
  ];

  it('places cues on the scene timeline', () => {
    const timeline = sceneTimeline(scenes);
    expect(timeline[0]).toMatchObject({ startSec: 0, endSec: 4 });
    expect(timeline[1]).toMatchObject({ startSec: 4, endSec: 10 });
  });

  it('writes VTT and SRT with RTL cue text for Persian', () => {
    const tracks = buildSubtitleTracks(scenes);
    expect(tracks.faVtt.startsWith('WEBVTT')).toBe(true);
    expect(tracks.faVtt).toContain('00:00:00.000 --> 00:00:04.000 align:right');
    expect(tracks.faVtt).toContain('\u200Fسلام');
    expect(tracks.faVtt).toContain('00:00:04.000 --> 00:00:10.000');
    expect(tracks.enVtt).toContain('Hello');
    expect(tracks.enVtt).not.toContain('ادامه');
    expect(tracks.faSrt).toContain('1\n00:00:00,000 --> 00:00:04,000');
    expect(tracks.enSrt).not.toContain('ادامه');
    expect(formatTimestamp(65.25, '.')).toBe('00:01:05.250');
  });
});
