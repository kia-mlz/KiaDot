# AI Lesson Motion Studio

Academy-only storyboard and render pipeline. It lives in `@kia./kia-academy`
(`kia./kia-academy/motion`) and the admin page `/admin/academy/motion`.
Other departments do not import it. Learners watch a published video inside the
existing lesson page at `/learn/...`.

## What it reads

A project is always tied to one existing course and one existing lesson.
Analysis uses that lesson’s stored title, content, English content when present,
course title and description, chapter title, fenced code, and course attachments.
It does not invent a topic essay. The deterministic analyzer is the default and
needs no API key. Provider id is `deterministic` and token usage is 0.

If the lesson is empty, the project stores a warning and no scenes. An unclosed
code fence is not turned into a code scene. Repeated headings with different
bodies are flagged for the instructor. Code shown in a scene is copied from the
lesson, unless the instructor edits it — those edits are labeled `instructor`.

## Approval

Statuses: Draft, Analyzing, Storyboarding, AwaitingApproval, Rendering,
Processing, Completed, Failed, Published, Archived.

Render does not start until the storyboard is approved. `autoRender` defaults
to false and is stored on the project. Only a course editor (or super admin)
can turn it on. Publishing writes a `MotionLessonVideo` row whose lesson id is
part of the foreign key back to the project, so the video cannot be attached
to a different lesson. If the lesson text hash changes later, the published
video is marked stale and kept until a new version is approved and published.

Watch progress (last time, percent, completed, last viewed, view count) is
stored per learner. Minimum watch percent lives on the published relation and
defaults to off, so existing lessons are not locked.

## Render

The API process runs one render at a time from a database queue (`setInterval`
in `MotionJobRunner`). Cancel sets a flag and aborts the ffmpeg process and
the headless Chrome process that is drawing frames. Retry
queues a new job. Temporary frames live under `uploads/motion-private/<projectId>/`
and are not public URLs. Cleanup removes svg frames and segment files and keeps
the finished mp4.

Each scene is a moving picture of **that scene’s own span**. A deterministic
plan reads the scene title, the short on-screen line, the narration, and the
lesson code fence. It does not invent a tag, file, or CSS property the span
never names. On the frame, words stay short (the concept, a tag, a step). The
long paragraph stays in the lesson body and in the narration field, which is
also the subtitle source. It is not drawn as a paragraph on the picture.

What the picture does:

- HTML spans draw the named tags. A page outline appears, `<!DOCTYPE html>`
  types on when the lesson says it, and `<html>`, `<head>`, and `<body>` nest
  when those tags are in the span. The lesson’s own code types on beside them.
- CSS spans move one shape using only the properties named in the span
  (color, size, or position). An axis arrow appears only for
  `justify-content`, `align-items`, or `flex-direction`.
- JavaScript spans slide the names and values written in the lesson
  (`const`, `let`, `var`, `function`). The lesson’s JavaScript is never executed.
- File spans show the named folder and files (`index.html`, and so on).
- Lists show the lesson’s own steps, one at a time.
- Other spans are one big idea: kinetic type and one shape drawn from
  primitives. No clip art is fetched.

Elements enter, grow, nest, or slide across the scene. The admin preview is
the same HTML document with a CSS `--t` animation, loaded in a sandboxed
iframe (`sandbox=""`), so it cannot run scripts. Render captures that document
in headless Chrome at several frames per second, with `--t` set by the
renderer (not by lesson code), then ffmpeg encodes H.264 at 1920×1080 or
1280×720, 24 or 30 fps. Persian uses Noto Naskh Arabic, with DejaVu Sans as
the fallback that still draws punctuation. Code uses DejaVu Sans Mono.
Academy colour comes from `@kia./brand`. Paper and ink use the documented
`--ink-*` values. Every lesson string placed in the HTML is escaped
(`& < > " '`).

Temporary stage HTML and PNG frames live under
`uploads/motion-private/<projectId>/` and are not public URLs. Cleanup removes
them and keeps the finished mp4. The mp4 is a server-chosen `video-vN.mp4`,
not a name from the request. Narration uploads and TTS audio are stored only
after an allowlisted MIME, a 20 MB cap, and magic bytes agree, under a
server-chosen name in that same private directory. The media response sends
`X-Content-Type-Options: nosniff`.

If `ffmpeg` or Chrome is missing, the job status is Failed and the error says
what to install. The pipeline never writes a fake mp4.

```bash
sudo apt-get install -y ffmpeg fonts-dejavu-core fonts-noto-core
ffmpeg -version
google-chrome --version || chromium --version
```

Fonts expected on the machine:

- `/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf`
- `/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf`
- `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`
- `/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf`

## Audio and subtitles

Narration text is stored per scene even when no speech engine is configured.

TTS runs only when all of `MOTION_TTS_BASE_URL`, `MOTION_TTS_API_KEY`, and
`MOTION_TTS_MODEL` are set. Otherwise the status is `unconfigured`. The
instructor can upload audio (mpeg, wav, mp4, webm, ogg; magic bytes checked;
20 MB; server-chosen filename). Uploaded audio is mixed on the next render.
Without a file, the mp4 is silent and the player says narration audio is not
attached.

VTT and SRT tracks are generated from scene start and end. Persian cues use an
RTL mark and `align:right`. Instructors can replace cue text; edited tracks are
kept when scenes change.

## Environment

Server only. Do not use `NEXT_PUBLIC_` for these. Do not store the secrets in
the database. Temperature and max tokens are the only analyzer settings in
`MotionAiProviderSettings`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MOTION_AI_BASE_URL` | no | OpenAI-compatible base URL, no trailing path beyond the host root |
| `MOTION_AI_API_KEY` | no | Bearer token. Never sent to the browser |
| `MOTION_AI_MODEL` | no | Model id |
| `MOTION_TTS_BASE_URL` | no | Speech API base. Unset means TTS is unconfigured |
| `MOTION_TTS_API_KEY` | no | Bearer token |
| `MOTION_TTS_MODEL` | no | Speech model id |

All three AI variables must be set or the deterministic analyzer is used. If
the external provider errors, the job fails. It is not replaced with fake scenes.
The admin screen shows configured versus unconfigured without revealing secrets.

Each run is written to `MotionAiUsageLog` (provider, model, lesson id, tokens
when known, status, error).

## Who can do what

Create, analyze, render, and publish require the same course-edit access as the
academy course editor (`JwtAuthGuard`, `RolesGuard`, `AdminAccess('courses', 'edit')`).
Learners can read a published video only for a lesson they can already open, and
can write only their own watch progress.
