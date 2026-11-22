'use client';

import { Clapperboard } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminErrorState, AdminLoading } from '@/components/admin/AdminStates';
import { useAdminAccess } from '@/components/admin/useAdminAccess';
import { useLanguage } from '@/context/LanguageProvider';
import { api, ApiError } from '@/lib/api';
import type {
  MotionCatalogCourse,
  MotionDashboard,
  MotionProject,
  MotionScene,
  MotionSettings,
} from '@/lib/motionTypes';

const STYLES = ['kinetic', 'code', 'split', 'motion'] as const;

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function MotionStudio() {
  const { t } = useLanguage();
  const { can } = useAdminAccess();
  const [dashboard, setDashboard] = useState<MotionDashboard | null>(null);
  const [settings, setSettings] = useState<MotionSettings | null>(null);
  const [catalog, setCatalog] = useState<MotionCatalogCourse[]>([]);
  const [projectList, setProjectList] = useState<
    { id: string; title: string; status: string; lessonTitle: string; published: boolean }[]
  >([]);
  const [project, setProject] = useState<MotionProject | null>(null);
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [draft, setDraft] = useState({
    style: 'kinetic',
    aspect: '1920x1080',
    fps: 30,
    quality: 'standard',
    language: 'fa',
    voiceId: '',
    targetDurationSec: 90,
    sceneCountHint: 0,
    autoRender: false,
  });
  const [sceneDraft, setSceneDraft] = useState<MotionScene | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [counts, config, courses, list] = await Promise.all([
        api.motionDashboard(),
        api.motionSettings(),
        api.motionCatalog(),
        api.motionProjects(),
      ]);
      setDashboard(counts);
      setSettings(config);
      setCatalog(courses);
      setProjectList(list);
    } catch (err) {
      setError(message(err, t('motionStudio.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!project) return;
    if (!['Analyzing', 'Rendering', 'Processing'].includes(project.status)) return;
    const timer = window.setInterval(() => {
      void api
        .motionGetProject(project.id)
        .then((next) => {
          setProject(next);
          if (!['Analyzing', 'Rendering', 'Processing'].includes(next.status)) {
            void api.motionDashboard().then(setDashboard).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [project]);

  const openProject = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const next = await api.motionGetProject(id);
      setProject(next);
      setSceneDraft(next.scenes[0] ?? null);
      setPreviewHtml('');
      setDraft({
        style: next.style,
        aspect: next.aspect,
        fps: next.fps,
        quality: next.quality,
        language: next.language,
        voiceId: next.voiceId,
        targetDurationSec: next.targetDurationSec,
        sceneCountHint: next.sceneCountHint,
        autoRender: next.autoRender,
      });
    } catch (err) {
      setError(message(err, t('motionStudio.loadError')));
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<MotionProject | void>, ok: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await action();
      if (next) {
        setProject(next);
        setSceneDraft((current) => next.scenes.find((scene) => scene.id === current?.id) ?? next.scenes[0] ?? null);
      }
      setNotice(ok);
      const [counts, list] = await Promise.all([api.motionDashboard(), api.motionProjects()]);
      setDashboard(counts);
      setProjectList(list);
    } catch (err) {
      setError(message(err, t('motionStudio.loadError')));
    } finally {
      setBusy(false);
    }
  };

  if (!can('courses')) {
    return (
      <div className="admin-content">
        <AdminErrorState message={t('motionStudio.denied')} />
      </div>
    );
  }
  if (loading) return <AdminLoading label={t('motionStudio.loading')} />;
  if (!dashboard || !settings) {
    return (
      <div className="admin-content">
        <AdminErrorState message={error || t('motionStudio.loadError')} onRetry={() => void load()} />
      </div>
    );
  }

  const course = catalog.find((item) => item.id === courseId);
  const statusLabel = (status: string) => t(`motionStudio.statuses.${status}`);

  return (
    <div className="admin-content motion-studio dept--academy">
      <header className="admin-card motion-studio-head">
        <div>
          <p className="motion-kicker">
            <Clapperboard size={16} aria-hidden /> Kia.Academy
          </p>
          <h1>{t('motionStudio.title')}</h1>
          <p className="muted">{t('motionStudio.intro')}</p>
        </div>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <section className="motion-counts">
        {(
          [
            ['produced', dashboard.produced],
            ['inProgress', dashboard.inProgress],
            ['awaiting', dashboard.awaitingApproval],
            ['published', dashboard.published],
            ['failed', dashboard.failed],
            ['aiUsage', dashboard.aiUsage],
          ] as const
        ).map(([key, value]) => (
          <article key={key} className="admin-card motion-count">
            <span>{t(`motionStudio.counts.${key}`)}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-card">
        <h2>{t('motionStudio.settingsTitle')}</h2>
        <p>
          {settings.aiConfigured
            ? t('motionStudio.aiConfigured', { provider: settings.aiProvider, model: settings.aiModel })
            : t('motionStudio.aiUnconfigured')}
        </p>
        <p>{settings.ttsConfigured ? t('motionStudio.ttsConfigured') : t('motionStudio.ttsUnconfigured')}</p>
        <div className="motion-form-grid">
          <label>
            {t('motionStudio.temperature')}
            <input
              className="input"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(event) =>
                setSettings({ ...settings, temperature: Number(event.target.value) })
              }
            />
          </label>
          <label>
            {t('motionStudio.maxTokens')}
            <input
              className="input"
              type="number"
              min={100}
              max={8000}
              value={settings.maxTokens}
              onChange={(event) => setSettings({ ...settings, maxTokens: Number(event.target.value) })}
            />
          </label>
        </div>
        <button
          type="button"
          className="pill-btn"
          disabled={busy || !can('courses', 'edit')}
          onClick={() =>
            void run(async () => {
              const next = await api.motionUpdateSettings({
                temperature: settings.temperature,
                maxTokens: settings.maxTokens,
              });
              setSettings(next);
            }, t('motionStudio.saved'))
          }
        >
          {t('motionStudio.saveSettings')}
        </button>
      </section>

      <section className="admin-card">
        <h2>{t('motionStudio.newProject')}</h2>
        <div className="motion-form-grid">
          <label>
            {t('motionStudio.course')}
            <select className="input" value={courseId} onChange={(event) => { setCourseId(event.target.value); setLessonId(''); }}>
              <option value="">{t('motionStudio.choose')}</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          <label>
            {t('motionStudio.lesson')}
            <select className="input" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              <option value="">{t('motionStudio.choose')}</option>
              {(course?.lessons ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.chapterTitle ? `${item.chapterTitle} — ` : ''}{item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('motionStudio.style')}
            <select className="input" value={draft.style} onChange={(event) => setDraft({ ...draft, style: event.target.value })}>
              {STYLES.map((style) => (
                <option key={style} value={style}>{t(`motionStudio.styles.${style}`)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('motionStudio.aspect')}
            <select className="input" value={draft.aspect} onChange={(event) => setDraft({ ...draft, aspect: event.target.value })}>
              <option value="1920x1080">1920×1080</option>
              <option value="1280x720">1280×720</option>
            </select>
          </label>
          <label>
            {t('motionStudio.fps')}
            <select className="input" value={draft.fps} onChange={(event) => setDraft({ ...draft, fps: Number(event.target.value) })}>
              <option value={24}>24</option>
              <option value={30}>30</option>
            </select>
          </label>
          <label>
            {t('motionStudio.quality')}
            <select className="input" value={draft.quality} onChange={(event) => setDraft({ ...draft, quality: event.target.value })}>
              <option value="standard">{t('motionStudio.qualityStandard')}</option>
              <option value="high">{t('motionStudio.qualityHigh')}</option>
            </select>
          </label>
          <label>
            {t('motionStudio.language')}
            <select className="input" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>
              <option value="fa">{t('motionStudio.trackFa')}</option>
              <option value="en">{t('motionStudio.trackEn')}</option>
            </select>
          </label>
          <label>
            {t('motionStudio.voice')}
            <input className="input" value={draft.voiceId} onChange={(event) => setDraft({ ...draft, voiceId: event.target.value })} />
          </label>
          <label>
            {t('motionStudio.duration')}
            <input className="input" type="number" min={8} max={600} value={draft.targetDurationSec} onChange={(event) => setDraft({ ...draft, targetDurationSec: Number(event.target.value) })} />
          </label>
          <label>
            {t('motionStudio.sceneHint')}
            <input className="input" type="number" min={0} max={40} value={draft.sceneCountHint} onChange={(event) => setDraft({ ...draft, sceneCountHint: Number(event.target.value) })} />
          </label>
        </div>
        <label className="motion-check">
          <input
            type="checkbox"
            checked={draft.autoRender}
            onChange={(event) => setDraft({ ...draft, autoRender: event.target.checked })}
          />
          {t('motionStudio.autoRender')}
        </label>
        <p className="muted">{t('motionStudio.autoRenderHint')}</p>
        <button
          type="button"
          className="pill-btn pill-btn--primary"
          disabled={busy || !lessonId || !can('courses', 'edit')}
          onClick={() =>
            void run(
              () =>
                api.motionCreateProject({
                  lessonId,
                  style: draft.style as (typeof STYLES)[number],
                  aspect: draft.aspect as '1920x1080' | '1280x720',
                  fps: draft.fps as 24 | 30,
                  quality: draft.quality as 'standard' | 'high',
                  language: draft.language as 'fa' | 'en',
                  voiceId: draft.voiceId,
                  targetDurationSec: draft.targetDurationSec,
                  sceneCountHint: draft.sceneCountHint,
                  autoRender: draft.autoRender,
                }),
              t('motionStudio.created'),
            )
          }
        >
          {t('motionStudio.create')}
        </button>
      </section>

      <section className="admin-card">
        <h2>{t('motionStudio.projects')}</h2>
        {projectList.length === 0 ? <p className="muted">{t('motionStudio.emptyProjects')}</p> : null}
        <ul className="motion-project-list">
          {projectList.map((item) => (
            <li key={item.id}>
              <button type="button" className="pill-btn" onClick={() => void openProject(item.id)}>
                {item.lessonTitle} — {statusLabel(item.status)}
                {item.published && item.status !== 'Published' ? ` · ${t('motionStudio.publishedBadge')}` : ''}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {project ? (
        <section className="admin-card motion-project">
          <h2>{project.lessonTitle}</h2>
          <p>
            {project.courseTitle}
            {project.chapterTitle ? ` · ${project.chapterTitle}` : ''}
          </p>
          <p>
            {t('motionStudio.status')}: <strong>{statusLabel(project.status)}</strong>
            {' · '}
            {project.providerId} / {project.model}
            {' · v'}
            {project.contentVersion}/{project.videoVersion}
          </p>
          {project.stale ? <p className="form-error">{t('motionStudio.stale')}</p> : null}
          {project.published && !project.approvedAt ? <p className="muted">{t('motionStudio.republishHint')}</p> : null}
          <p className="muted">{project.courseDescription}</p>
          {project.concepts.length ? (
            <p>
              {t('motionStudio.concepts')}: {project.concepts.join('، ')}
            </p>
          ) : null}
          {project.warnings.map((warning) => (
            <p key={warning.code} className="form-error">{warning.message}</p>
          ))}
          {project.attachments.length ? (
            <p>
              {t('motionStudio.attachments')}: {project.attachments.map((item) => item.title).join('، ')}
            </p>
          ) : null}
          <p>
            {t('motionStudio.audioState')}: {t(`motionStudio.audio.${project.narrationAudioStatus}`)}
          </p>

          <div className="motion-actions">
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionAnalyze(project.id), t('motionStudio.queued'))}>{t('motionStudio.analyze')}</button>
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionApprove(project.id), t('motionStudio.approved'))}>{t('motionStudio.approve')}</button>
            <button type="button" className="pill-btn pill-btn--primary" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionRender(project.id), t('motionStudio.queued'))}>{t('motionStudio.render')}</button>
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionPublish(project.id, { lessonId: project.lessonId, position: project.position, minWatchPercent: project.minWatchPercent }), t('motionStudio.published'))}>{t('motionStudio.publish')}</button>
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionUnpublish(project.id), t('motionStudio.unpublished'))}>{t('motionStudio.unpublish')}</button>
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionNewVersion(project.id), t('motionStudio.versionCreated'))}>{t('motionStudio.newVersion')}</button>
            <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionArchive(project.id), t('motionStudio.archived'))}>{t('motionStudio.archive')}</button>
            <button
              type="button"
              className="pill-btn"
              disabled={busy || !can('courses', 'edit')}
              onClick={() =>
                void run(async () => {
                  await api.motionDeleteProject(project.id);
                  setProject(null);
                }, t('motionStudio.deleted'))
              }
            >
              {t('motionStudio.delete')}
            </button>
          </div>

          <div className="motion-form-grid">
            <label>
              {t('motionStudio.position')}
              <select
                className="input"
                value={project.position}
                onChange={(event) =>
                  void run(
                    () => api.motionUpdateProject(project.id, { position: event.target.value as 'BEFORE_BODY' | 'AFTER_OBJECTIVES' }),
                    t('motionStudio.saved'),
                  )
                }
              >
                <option value="BEFORE_BODY">{t('motionStudio.beforeBody')}</option>
                <option value="AFTER_OBJECTIVES">{t('motionStudio.afterObjectives')}</option>
              </select>
            </label>
            <label>
              {t('motionStudio.minWatch')}
              <input
                className="input"
                type="number"
                min={1}
                max={100}
                placeholder={t('motionStudio.minWatchOff')}
                value={project.minWatchPercent ?? ''}
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = raw === '' ? null : Number(raw);
                  setProject({ ...project, minWatchPercent: value });
                  if (!project.published) return;
                  void run(
                    () => api.motionUpdateProject(project.id, { minWatchPercent: value }),
                    t('motionStudio.saved'),
                  );
                }}
              />
            </label>
            <label>
              {t('motionStudio.audioUpload')}
              <input
                className="input"
                type="file"
                accept="audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void run(() => api.motionUploadAudio(project.id, file), t('motionStudio.audioSaved'));
                }}
              />
            </label>
          </div>

          <h3>{t('motionStudio.scenes')}</h3>
          <ol className="motion-scenes">
            {project.scenes.map((scene, index) => (
              <li
                key={scene.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', scene.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromId = event.dataTransfer.getData('text/plain');
                  if (!fromId || fromId === scene.id) return;
                  const ids = project.scenes.map((item) => item.id);
                  const from = ids.indexOf(fromId);
                  const to = ids.indexOf(scene.id);
                  if (from < 0 || to < 0) return;
                  ids.splice(from, 1);
                  ids.splice(to, 0, fromId);
                  void run(() => api.motionReorderScenes(project.id, ids), t('motionStudio.saved'));
                }}
              >
                <button type="button" className={`pill-btn${sceneDraft?.id === scene.id ? ' pill-btn--primary' : ''}`} onClick={() => { setSceneDraft(scene); setPreviewHtml(''); }}>
                  {index + 1}. {scene.title}
                </button>
                <button
                  type="button"
                  className="pill-btn"
                  disabled={index === 0 || busy}
                  onClick={() => {
                    const ids = project.scenes.map((item) => item.id);
                    const swap = ids[index - 1];
                    const current = ids[index];
                    if (!swap || !current) return;
                    ids[index - 1] = current;
                    ids[index] = swap;
                    void run(() => api.motionReorderScenes(project.id, ids), t('motionStudio.saved'));
                  }}
                >
                  {t('motionStudio.moveUp')}
                </button>
                <button
                  type="button"
                  className="pill-btn"
                  disabled={index === project.scenes.length - 1 || busy}
                  onClick={() => {
                    const ids = project.scenes.map((item) => item.id);
                    const swap = ids[index + 1];
                    const current = ids[index];
                    if (!swap || !current) return;
                    ids[index + 1] = current;
                    ids[index] = swap;
                    void run(() => api.motionReorderScenes(project.id, ids), t('motionStudio.saved'));
                  }}
                >
                  {t('motionStudio.moveDown')}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="pill-btn" disabled={busy || !can('courses', 'edit')} onClick={() => void run(() => api.motionAddScene(project.id), t('motionStudio.saved'))}>
            {t('motionStudio.addScene')}
          </button>

          {sceneDraft ? (
            <div className="motion-scene-editor">
              <p className="muted">
                {sceneDraft.codeSource === 'instructor' ? t('motionStudio.instructorCode') : t('motionStudio.lessonCode')}
                {' · '}
                {sceneDraft.sourceStart}–{sceneDraft.sourceEnd}
              </p>
              <label>
                {t('motionStudio.narration')}
                <textarea className="input" rows={4} value={sceneDraft.narration} onChange={(event) => setSceneDraft({ ...sceneDraft, narration: event.target.value })} />
              </label>
              <label>
                {t('motionStudio.narrationEn')}
                <textarea className="input" rows={3} value={sceneDraft.narrationEn} onChange={(event) => setSceneDraft({ ...sceneDraft, narrationEn: event.target.value })} />
              </label>
              <label>
                {t('motionStudio.onScreen')}
                <input className="input" value={sceneDraft.onScreenText} onChange={(event) => setSceneDraft({ ...sceneDraft, onScreenText: event.target.value })} />
              </label>
              <label>
                {t('motionStudio.durationSec')}
                <input className="input" type="number" min={3} max={40} value={sceneDraft.durationSec} onChange={(event) => setSceneDraft({ ...sceneDraft, durationSec: Number(event.target.value) })} />
              </label>
              <label>
                {t('motionStudio.style')}
                <select className="input" value={sceneDraft.animationType} onChange={(event) => setSceneDraft({ ...sceneDraft, animationType: event.target.value })}>
                  {STYLES.map((style) => (
                    <option key={style} value={style}>{t(`motionStudio.styles.${style}`)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('motionStudio.code')}
                <textarea className="input" rows={5} dir="ltr" value={sceneDraft.code} onChange={(event) => setSceneDraft({ ...sceneDraft, code: event.target.value })} />
              </label>
              <div className="motion-actions">
                <button
                  type="button"
                  className="pill-btn pill-btn--primary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        api.motionUpdateScene(project.id, sceneDraft.id, {
                          title: sceneDraft.title,
                          narration: sceneDraft.narration,
                          narrationEn: sceneDraft.narrationEn,
                          onScreenText: sceneDraft.onScreenText,
                          durationSec: sceneDraft.durationSec,
                          animationType: sceneDraft.animationType as (typeof STYLES)[number],
                          code: sceneDraft.code,
                          codeLanguage: sceneDraft.codeLanguage,
                        }),
                      t('motionStudio.saved'),
                    )
                  }
                >
                  {t('motionStudio.saveScene')}
                </button>
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() =>
                    void api.motionPreview(project.id, sceneDraft.id).then((result) => setPreviewHtml(result.html)).catch((err) => setError(message(err, t('motionStudio.loadError'))))
                  }
                >
                  {t('motionStudio.preview')}
                </button>
                <button type="button" className="pill-btn" disabled={busy} onClick={() => void run(() => api.motionDeleteScene(project.id, sceneDraft.id), t('motionStudio.saved'))}>
                  {t('motionStudio.deleteScene')}
                </button>
              </div>
              {previewHtml ? (
                <iframe className="motion-preview" sandbox="" srcDoc={previewHtml} title={t('motionStudio.preview')} />
              ) : null}
            </div>
          ) : null}

          <h3>{t('motionStudio.jobs')}</h3>
          <ul className="motion-jobs">
            {project.jobs.map((job) => (
              <li key={job.id}>
                <span>{job.kind} — {job.status}</span>
                {job.errorLog ? <pre>{job.errorLog}</pre> : null}
                <button type="button" className="pill-btn" disabled={busy} onClick={() => void run(() => api.motionCancelJob(job.id), t('motionStudio.cancelled'))}>{t('motionStudio.cancel')}</button>
                <button type="button" className="pill-btn" disabled={busy} onClick={() => void run(() => api.motionRetryJob(job.id), t('motionStudio.queued'))}>{t('motionStudio.retry')}</button>
              </li>
            ))}
          </ul>
          <button type="button" className="pill-btn" disabled={busy} onClick={() => void api.motionCleanup(project.id).then(() => setNotice(t('motionStudio.cleaned'))).catch((err) => setError(message(err, t('motionStudio.loadError'))))}>
            {t('motionStudio.cleanup')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
