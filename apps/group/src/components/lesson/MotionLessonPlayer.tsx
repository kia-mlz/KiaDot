'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { useLanguage } from '@/context/LanguageProvider';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/mediaUrl';
import type { PublishedMotionVideo } from '@/lib/motionTypes';
import {
  PLAYER_SPEEDS,
  bufferedPortions,
  clamp,
  formatPlayerTime,
  playerKeyAction,
  ratioFromClientX,
  type Portion,
} from './playerChrome';

const HIDE_MS = 2800;

export function MotionLessonPlayer({
  video,
  onTime,
  seekRef,
}: {
  video: PublishedMotionVideo;
  onTime: (seconds: number) => void;
  seekRef: MutableRefObject<((seconds: number) => void) | null>;
}) {
  const { t, locale } = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekTrackRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const dragging = useRef(false);
  const rememberedVolume = useRef(1);
  const controlsOnRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(video.progress?.lastTimeSec ?? 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [track, setTrack] = useState(video.subtitles[0]?.locale ?? 'off');
  const [trackUrls, setTrackUrls] = useState<{ locale: string; url: string }[]>([]);
  const [buffered, setBuffered] = useState<Portion[]>([]);
  const [controlsOn, setControlsOn] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [menu, setMenu] = useState<'speed' | 'captions' | null>(null);
  const [activity, setActivity] = useState(0);
  const [overChrome, setOverChrome] = useState(false);
  const src = mediaUrl(video.videoUrl);
  const played = duration > 0 ? clamp(current / duration, 0, 1) : 0;
  const idle = playing && !controlsOn && !seeking && menu === null;

  useEffect(() => {
    controlsOnRef.current = controlsOn;
  }, [controlsOn]);

  const poke = useCallback(() => {
    setActivity((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!playing || seeking || menu || overChrome) {
      setControlsOn(true);
      return;
    }
    setControlsOn(true);
    const id = window.setTimeout(() => setControlsOn(false), HIDE_MS);
    return () => window.clearTimeout(id);
  }, [playing, seeking, menu, activity, overChrome]);

  useEffect(() => {
    const urls = video.subtitles.map((item) => ({
      locale: item.locale,
      url: URL.createObjectURL(new Blob([item.vtt], { type: 'text/vtt' })),
    }));
    setTrackUrls(urls);
    return () => {
      for (const item of urls) URL.revokeObjectURL(item.url);
    };
  }, [video.subtitles]);

  const persist = useCallback(
    (ended = false, viewStart = false) => {
      const element = videoRef.current;
      if (!element) return;
      void api
        .motionSaveProgress(video.lessonId, {
          lastTimeSec: element.currentTime || 0,
          durationSec: Number.isFinite(element.duration) ? element.duration : undefined,
          ended,
          viewStart,
        })
        .catch(() => undefined);
    },
    [video.lessonId],
  );

  const queueSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persist(false, false), 4000);
  }, [persist]);

  useEffect(() => {
    seekRef.current = (seconds: number) => {
      const element = videoRef.current;
      if (!element) return;
      element.currentTime = seconds;
      onTime(seconds);
      setCurrent(seconds);
      void element.play().catch(() => undefined);
    };
    return () => {
      seekRef.current = null;
    };
  }, [onTime, seekRef]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      persist(false, false);
    };
  }, [persist]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = muted || volume === 0;
  }, [muted, volume]);

  const syncBuffered = useCallback(() => {
    const element = videoRef.current;
    if (!element || !Number.isFinite(element.duration)) return;
    const ranges: Array<{ start: number; end: number }> = [];
    for (let index = 0; index < element.buffered.length; index += 1) {
      ranges.push({ start: element.buffered.start(index), end: element.buffered.end(index) });
    }
    setBuffered(bufferedPortions(ranges, element.duration));
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      const element = videoRef.current;
      const limit = element && Number.isFinite(element.duration) ? element.duration : duration;
      const next = clamp(seconds, 0, limit || 0);
      if (element) element.currentTime = next;
      setCurrent(next);
      onTime(next);
    },
    [duration, onTime],
  );

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const trackEl = seekTrackRef.current;
      const element = videoRef.current;
      if (!trackEl || !element || !Number.isFinite(element.duration)) return;
      const ratio = ratioFromClientX(clientX, trackEl.getBoundingClientRect());
      seekTo(ratio * element.duration);
    },
    [seekTo],
  );

  const togglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => undefined);
    else element.pause();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      if (wasMuted || volume === 0) {
        const restore = rememberedVolume.current > 0 ? rememberedVolume.current : 1;
        setVolume(restore);
        return false;
      }
      rememberedVolume.current = volume;
      setVolume(0);
      return true;
    });
  }, [volume]);

  const toggleFullscreen = useCallback(async () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    try {
      if (!document.fullscreenElement) await wrap.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      const element = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      element?.webkitEnterFullscreen?.();
    }
  }, []);

  const applyTrack = useCallback((next: string) => {
    setTrack(next);
    const element = videoRef.current;
    if (!element) return;
    for (let index = 0; index < element.textTracks.length; index += 1) {
      const textTrack = element.textTracks[index];
      if (!textTrack) continue;
      textTrack.mode = textTrack.language === next ? 'showing' : 'disabled';
    }
  }, []);

  const onPlayerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    if (menu) {
      if (event.key === 'Escape') {
        setMenu(null);
        event.preventDefault();
      }
      return;
    }
    const action = playerKeyAction(event.key);
    if (!action) return;
    if (event.key === ' ' && target.closest('button, a')) return;
    event.preventDefault();
    poke();
    if (action.type === 'toggle') togglePlay();
    else if (action.type === 'seek') seekTo((videoRef.current?.currentTime ?? current) + action.delta);
    else if (action.type === 'volume') {
      const base = muted ? 0 : volume;
      const next = clamp(base + action.delta, 0, 1);
      if (next > 0) rememberedVolume.current = next;
      setVolume(next);
      setMuted(next === 0);
    } else if (action.type === 'mute') toggleMute();
    else void toggleFullscreen();
  };

  const onVideoClick = () => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse && !controlsOnRef.current) {
      poke();
      return;
    }
    togglePlay();
    poke();
    wrapRef.current?.focus({ preventScroll: true });
  };

  const onSeekPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    dragging.current = true;
    setSeeking(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromPointer(event.clientX);
  };

  const onSeekPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    seekFromPointer(event.clientX);
  };

  const onSeekPointerUp = () => {
    dragging.current = false;
    setSeeking(false);
  };

  if (!src) return null;

  return (
    <div
      className={`lesson-video-block motion-player dept--academy${idle ? ' is-idle' : ''}`}
      ref={wrapRef}
      tabIndex={0}
      role="region"
      aria-label={t('motionStudio.playerTitle')}
      onKeyDown={onPlayerKeyDown}
      onPointerMove={() => {
        if (window.matchMedia('(pointer: fine)').matches) poke();
      }}
      onPointerDown={(event) => {
        poke();
        const target = event.target as HTMLElement;
        if (!target.closest('.motion-pop')) setMenu(null);
      }}
    >
      <div className="motion-stage lesson-video">
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          onClick={onVideoClick}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setDuration(element.duration || 0);
            syncBuffered();
            const resumeAt = video.progress?.lastTimeSec ?? 0;
            if (resumeAt > 1 && resumeAt < element.duration - 1) {
              element.currentTime = resumeAt;
              setCurrent(resumeAt);
              onTime(resumeAt);
            }
          }}
          onProgress={syncBuffered}
          onTimeUpdate={(event) => {
            const time = event.currentTarget.currentTime;
            setCurrent(time);
            onTime(time);
            syncBuffered();
            if (!started.current && time > 0.2) {
              started.current = true;
              persist(false, true);
            } else {
              queueSave();
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            persist(false, false);
          }}
          onEnded={() => {
            setPlaying(false);
            persist(true, false);
          }}
        >
          {trackUrls.map((item) => (
            <track
              key={item.locale}
              kind="subtitles"
              src={item.url}
              srcLang={item.locale}
              label={item.locale === 'fa' ? t('motionStudio.trackFa') : t('motionStudio.trackEn')}
              default={track === item.locale}
            />
          ))}
        </video>

        {playing ? null : (
          <button
            type="button"
            className="motion-center"
            onClick={(event) => {
              event.stopPropagation();
              togglePlay();
              poke();
            }}
            aria-label={t('motionStudio.play')}
          >
            <PlayIcon />
          </button>
        )}

        <div className="motion-top" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
          <span className="lesson-video-label">{t('motionStudio.playerTitle')}</span>
          {video.stale ? <span className="meta-chip">{t('motionStudio.stale')}</span> : null}
          {!video.narrationAudioAttached ? (
            <span className="meta-chip">{t('motionStudio.noAudio')}</span>
          ) : null}
        </div>

        <div
          className="motion-bar"
          dir="ltr"
          onPointerEnter={() => setOverChrome(true)}
          onPointerLeave={() => setOverChrome(false)}
        >
          <div
            className="motion-seek"
            ref={seekTrackRef}
            role="slider"
            tabIndex={0}
            aria-label={t('motionStudio.progress')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 0}
            aria-valuenow={Math.round(current) || 0}
            aria-valuetext={`${formatPlayerTime(current)} / ${formatPlayerTime(duration)}`}
            onPointerDown={onSeekPointerDown}
            onPointerMove={onSeekPointerMove}
            onPointerUp={onSeekPointerUp}
            onPointerCancel={onSeekPointerUp}
          >
            <span className="motion-seek-track">
              {buffered.map((span) => (
                <span
                  key={`${span.start.toFixed(4)}-${span.end.toFixed(4)}`}
                  className="motion-seek-buffered"
                  style={{ left: `${span.start * 100}%`, width: `${(span.end - span.start) * 100}%` }}
                />
              ))}
              <span className="motion-seek-played" style={{ width: `${played * 100}%` }} />
            </span>
            <span className="motion-seek-thumb" style={{ left: `${played * 100}%` }} />
          </div>

          <div className="motion-bar-row">
            <button
              type="button"
              className="motion-icon-btn"
              onClick={togglePlay}
              aria-label={playing ? t('motionStudio.pause') : t('motionStudio.play')}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <span className="motion-time">
              <span>{formatPlayerTime(current)}</span>
              <span className="motion-time-gap" aria-hidden="true">
                {' / '}
              </span>
              <span className="motion-time-duration">{formatPlayerTime(duration)}</span>
            </span>
            <span className="motion-spacer" />
            <div className="motion-volume">
              <button
                type="button"
                className="motion-icon-btn"
                onClick={toggleMute}
                aria-label={muted || volume === 0 ? t('motionStudio.unmute') : t('motionStudio.mute')}
                aria-pressed={muted || volume === 0}
              >
                <VolumeIcon muted={muted || volume === 0} level={volume} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                aria-label={t('motionStudio.volume')}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (next > 0) rememberedVolume.current = next;
                  setVolume(next);
                  setMuted(next === 0);
                }}
              />
            </div>
            <div className="motion-pop">
              <button
                type="button"
                className="motion-rate-btn"
                aria-haspopup="menu"
                aria-expanded={menu === 'speed'}
                aria-label={t('motionStudio.speed')}
                onClick={() => setMenu((open) => (open === 'speed' ? null : 'speed'))}
              >
                {speed}×
              </button>
              {menu === 'speed' ? (
                <ul className="motion-menu" role="menu" aria-label={t('motionStudio.speed')}>
                  {PLAYER_SPEEDS.map((value) => (
                    <li key={value} role="none">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={speed === value}
                        className={speed === value ? 'is-current' : undefined}
                        onClick={() => {
                          setSpeed(value);
                          setMenu(null);
                        }}
                      >
                        {value}×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {video.subtitles.length > 0 ? (
              <div className="motion-pop">
                <button
                  type="button"
                  className="motion-icon-btn"
                  aria-haspopup="menu"
                  aria-expanded={menu === 'captions'}
                  aria-label={t('motionStudio.subtitles')}
                  onClick={() => setMenu((open) => (open === 'captions' ? null : 'captions'))}
                >
                  <CaptionsIcon />
                </button>
                {menu === 'captions' ? (
                  <ul className="motion-menu" role="menu" aria-label={t('motionStudio.subtitles')}>
                    <li role="none">
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={track === 'off'}
                        className={track === 'off' ? 'is-current' : undefined}
                        onClick={() => {
                          applyTrack('off');
                          setMenu(null);
                        }}
                      >
                        {t('motionStudio.subtitlesOff')}
                      </button>
                    </li>
                    {video.subtitles.map((item) => (
                      <li key={item.locale} role="none">
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={track === item.locale}
                          className={track === item.locale ? 'is-current' : undefined}
                          onClick={() => {
                            applyTrack(item.locale);
                            setMenu(null);
                          }}
                        >
                          {item.locale === 'fa' ? t('motionStudio.trackFa') : t('motionStudio.trackEn')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="motion-icon-btn"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreen ? t('lesson.exitFullscreen') : t('lesson.fullscreen')}
            >
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M8 5.2v13.6L19 12 8 5.2z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 5h4.2v14H6zM13.8 5H18v14h-4.2z" fill="currentColor" />
    </svg>
  );
}

function VolumeIcon({ muted, level }: { muted: boolean; level: number }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.2v13.6l-4.8-4.3H4z" fill="currentColor" />
      {muted || level === 0 ? (
        <path d="M16 9.2l4.6 4.6M20.6 9.2 16 13.8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      ) : (
        <path
          d={level > 0.5 ? 'M16 8.2a5 5 0 0 1 0 7.6M18.4 6a8 8 0 0 1 0 12' : 'M16 8.2a5 5 0 0 1 0 7.6'}
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function CaptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 12.2h3.2M7 15h2.2M13 12.2h4M13 15h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
