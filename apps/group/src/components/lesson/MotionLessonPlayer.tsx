'use client';

import { Maximize2, Minimize2, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useLanguage } from '@/context/LanguageProvider';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/mediaUrl';
import type { PublishedMotionVideo } from '@/lib/motionTypes';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function MotionLessonPlayer({
  video,
  onTime,
  seekRef,
}: {
  video: PublishedMotionVideo;
  onTime: (seconds: number) => void;
  seekRef: MutableRefObject<((seconds: number) => void) | null>;
}) {
  const { t } = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(video.progress?.lastTimeSec ?? 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [track, setTrack] = useState(video.subtitles[0]?.locale ?? 'off');
  const [trackUrls, setTrackUrls] = useState<{ locale: string; url: string }[]>([]);
  const src = mediaUrl(video.videoUrl);

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

  const toggleFullscreen = async () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (!document.fullscreenElement) {
      await wrap.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  if (!src) return null;

  return (
    <div className="lesson-video-block motion-player dept--academy" ref={wrapRef}>
      <div className="lesson-video-toolbar">
        <span className="lesson-video-label">{t('motionStudio.playerTitle')}</span>
        {video.stale ? <span className="meta-chip">{t('motionStudio.stale')}</span> : null}
        {!video.narrationAudioAttached ? (
          <span className="meta-chip">{t('motionStudio.noAudio')}</span>
        ) : null}
      </div>
      <div className="lesson-video">
        <video
          ref={videoRef}
          src={src}
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setDuration(element.duration || 0);
            const resumeAt = video.progress?.lastTimeSec ?? 0;
            if (resumeAt > 1 && resumeAt < element.duration - 1) {
              element.currentTime = resumeAt;
              setCurrent(resumeAt);
              onTime(resumeAt);
            }
          }}
          onTimeUpdate={(event) => {
            const time = event.currentTarget.currentTime;
            setCurrent(time);
            onTime(time);
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
      </div>
      <div className="motion-controls">
        <button
          type="button"
          className="pill-btn"
          onClick={() => {
            const element = videoRef.current;
            if (!element) return;
            if (element.paused) void element.play();
            else element.pause();
          }}
          aria-label={playing ? t('motionStudio.pause') : t('motionStudio.play')}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="motion-time">
          {clock(current)} / {clock(duration)}
        </span>
        <input
          className="motion-scrub"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          aria-label={t('motionStudio.progress')}
          onChange={(event) => {
            const element = videoRef.current;
            const next = Number(event.target.value);
            if (element) element.currentTime = next;
            setCurrent(next);
            onTime(next);
          }}
        />
        <label className="motion-volume">
          <span className="sr-only">{t('motionStudio.volume')}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (videoRef.current) videoRef.current.volume = next;
            }}
          />
        </label>
        <label>
          <span className="sr-only">{t('motionStudio.speed')}</span>
          <select
            className="input motion-speed"
            value={speed}
            onChange={(event) => {
              const next = Number(event.target.value);
              setSpeed(next);
              if (videoRef.current) videoRef.current.playbackRate = next;
            }}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t('motionStudio.subtitles')}</span>
          <select
            className="input motion-speed"
            value={track}
            onChange={(event) => {
              const next = event.target.value;
              setTrack(next);
              const element = videoRef.current;
              if (!element) return;
              for (let index = 0; index < element.textTracks.length; index += 1) {
                const textTrack = element.textTracks[index];
                if (!textTrack) continue;
                textTrack.mode = textTrack.language === next ? 'showing' : 'disabled';
              }
            }}
          >
            <option value="off">{t('motionStudio.subtitlesOff')}</option>
            {video.subtitles.map((item) => (
              <option key={item.locale} value={item.locale}>
                {item.locale === 'fa' ? t('motionStudio.trackFa') : t('motionStudio.trackEn')}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="pill-btn" onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          <span>{fullscreen ? t('lesson.exitFullscreen') : t('lesson.fullscreen')}</span>
        </button>
      </div>
    </div>
  );
}
