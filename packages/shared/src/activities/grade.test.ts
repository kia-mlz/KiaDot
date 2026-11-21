import { describe, expect, it } from 'vitest';
import { gradeActivity, publicActivityPayload } from './grade';

describe('gradeActivity', () => {
  const quiz = {
    questions: [
      { prompt: '2+2', choices: ['3', '4'], answerIndex: 1 },
      { prompt: '3+3', choices: ['5', '6'], answerIndex: 1 },
    ],
  };

  it('scores a multiple-choice submission and hides the key', () => {
    const pub = publicActivityPayload('multiple_choice', quiz) as {
      questions: Array<{ answerIndex?: number; choices: string[] }>;
    };
    expect(pub.questions[0]?.answerIndex).toBeUndefined();
    expect(pub.questions[0]?.choices).toEqual(['3', '4']);

    const grade = gradeActivity('quiz', quiz, { answers: [1, 0] });
    expect(grade).toMatchObject({ score: 1, maxScore: 2, correct: 1, wrong: 1, timedOut: false });
  });

  it('zeroes the score when the time limit is exceeded', () => {
    const grade = gradeActivity('true_false', { questions: [{ prompt: 'Sky is blue', answer: true }] }, { answers: [true] }, {
      timeLimitSec: 30,
      elapsedSec: 31,
    });
    expect(grade.score).toBe(0);
    expect(grade.timedOut).toBe(true);
  });

  it('grades matching, fill-blank, and self-reported flashcards', () => {
    expect(
      gradeActivity('matching', { pairs: [{ left: 'HTML', right: 'Markup' }] }, { answers: ['markup'] }).correct,
    ).toBe(1);
    expect(
      gradeActivity('fill_blank', { questions: [{ prompt: 'CSS stands for', answer: 'Cascading Style Sheets' }] }, {
        answers: ['cascading style sheets'],
      }).score,
    ).toBe(1);
    expect(
      gradeActivity('flashcards', { cards: [{ front: 'a', back: 'b' }, { front: 'c', back: 'd' }] }, { known: [0, 0, 5] })
        .correct,
    ).toBe(1);
  });
});
