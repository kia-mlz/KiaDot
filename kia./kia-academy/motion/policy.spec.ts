import {
  canStartRender,
  isContentStale,
  lessonContentHash,
  nextCancelState,
  publishLessonMismatch,
  renderAllowed,
} from './policy';

describe('motion policy', () => {
  const lesson = { title: 'عنوان', content: 'متن درس', contentEn: 'English' };

  it('changes the stale flag only when the content hash changes', () => {
    const hash = lessonContentHash(lesson);
    expect(isContentStale(hash, lessonContentHash(lesson))).toBe(false);
    expect(isContentStale(hash, lessonContentHash({ ...lesson, content: 'متن عوض‌شده' }))).toBe(true);
  });

  it('refuses publish onto a different lesson', () => {
    expect(publishLessonMismatch('lesson-a', 'lesson-a')).toBe(false);
    expect(publishLessonMismatch('lesson-a', 'lesson-b')).toBe(true);
  });

  it('sets the cancel flag and cancels a queued job immediately', () => {
    expect(nextCancelState('QUEUED')).toEqual({ status: 'CANCELLED', cancelRequested: true });
    expect(nextCancelState('RUNNING')).toEqual({ status: 'RUNNING', cancelRequested: true });
    expect(nextCancelState('COMPLETED').cancelRequested).toBe(false);
  });

  it('does not let a learner start a render', () => {
    expect(canStartRender({ role: 'LEARNER', coursesEdit: true, coursesManage: true })).toBe(false);
    expect(canStartRender({ role: 'ADMIN', coursesEdit: false, coursesManage: false })).toBe(false);
    expect(canStartRender({ role: 'ADMIN', coursesEdit: true, coursesManage: false })).toBe(true);
    expect(canStartRender({ role: 'SUPER_ADMIN', coursesEdit: false, coursesManage: false })).toBe(true);
  });

  it('blocks render until approval unless autoRender is on', () => {
    expect(renderAllowed({ autoRender: false, approvedAt: null })).toBe(false);
    expect(renderAllowed({ autoRender: false, approvedAt: new Date() })).toBe(true);
    expect(renderAllowed({ autoRender: true, approvedAt: null })).toBe(true);
  });
});
