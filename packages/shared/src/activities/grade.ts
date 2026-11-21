/** Server-side grading for Academy learning activities. Answers never leave this module. */

export const ACTIVITY_KINDS = [
  'quiz',
  'multiple_choice',
  'matching',
  'true_false',
  'flashcards',
  'fill_blank',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ChoiceQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
}

export interface TrueFalseQuestion {
  prompt: string;
  answer: boolean;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface FillQuestion {
  prompt: string;
  answer: string;
}

export interface FlashCard {
  front: string;
  back: string;
}

export interface ActivityGrade {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  timedOut: boolean;
}

export function isActivityKind(value: string): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function questionsOf<T>(payload: unknown, key: string): T[] {
  const raw = asRecord(payload)[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/** Payload safe to send to the browser (no answer keys). */
export function publicActivityPayload(kind: ActivityKind, payload: unknown): unknown {
  if (kind === 'quiz' || kind === 'multiple_choice') {
    return {
      questions: questionsOf<ChoiceQuestion>(payload, 'questions').map((q) => ({
        prompt: q.prompt,
        choices: q.choices,
      })),
    };
  }
  if (kind === 'true_false') {
    return {
      questions: questionsOf<TrueFalseQuestion>(payload, 'questions').map((q) => ({
        prompt: q.prompt,
      })),
    };
  }
  if (kind === 'matching') {
    const pairs = questionsOf<MatchPair>(payload, 'pairs');
    return {
      left: pairs.map((p) => p.left),
      right: [...pairs.map((p) => p.right)].sort(),
    };
  }
  if (kind === 'fill_blank') {
    return {
      questions: questionsOf<FillQuestion>(payload, 'questions').map((q) => ({ prompt: q.prompt })),
    };
  }
  return {
    cards: questionsOf<FlashCard>(payload, 'cards').map((c) => ({ front: c.front, back: c.back })),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Grade a submission. Flashcards are self-reported (`known` indexes): the
 * learner marks which cards they knew. Every other kind is scored against the
 * stored key. A positive time limit that the elapsed seconds exceed zeroes the
 * score and still reports how many were right before the timeout.
 */
export function gradeActivity(
  kind: ActivityKind,
  payload: unknown,
  submission: unknown,
  options?: { timeLimitSec?: number; elapsedSec?: number },
): ActivityGrade {
  const elapsed = Math.max(0, Math.floor(options?.elapsedSec ?? 0));
  const limit = Math.max(0, Math.floor(options?.timeLimitSec ?? 0));
  const timedOut = limit > 0 && elapsed > limit;
  const sub = asRecord(submission);

  let correct = 0;
  let maxScore: number;

  if (kind === 'quiz' || kind === 'multiple_choice') {
    const questions = questionsOf<ChoiceQuestion>(payload, 'questions');
    const answers = Array.isArray(sub.answers) ? (sub.answers as unknown[]) : [];
    maxScore = questions.length;
    questions.forEach((q, i) => {
      if (answers[i] === q.answerIndex) correct += 1;
    });
  } else if (kind === 'true_false') {
    const questions = questionsOf<TrueFalseQuestion>(payload, 'questions');
    const answers = Array.isArray(sub.answers) ? (sub.answers as unknown[]) : [];
    maxScore = questions.length;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) correct += 1;
    });
  } else if (kind === 'matching') {
    const pairs = questionsOf<MatchPair>(payload, 'pairs');
    const answers = Array.isArray(sub.answers) ? (sub.answers as unknown[]) : [];
    maxScore = pairs.length;
    pairs.forEach((pair, i) => {
      if (typeof answers[i] === 'string' && normalize(answers[i] as string) === normalize(pair.right)) {
        correct += 1;
      }
    });
  } else if (kind === 'fill_blank') {
    const questions = questionsOf<FillQuestion>(payload, 'questions');
    const answers = Array.isArray(sub.answers) ? (sub.answers as unknown[]) : [];
    maxScore = questions.length;
    questions.forEach((q, i) => {
      if (typeof answers[i] === 'string' && normalize(answers[i] as string) === normalize(q.answer)) {
        correct += 1;
      }
    });
  } else {
    const cards = questionsOf<FlashCard>(payload, 'cards');
    const known = Array.isArray(sub.known) ? (sub.known as unknown[]) : [];
    maxScore = cards.length;
    const seen = new Set<number>();
    for (const index of known) {
      if (typeof index === 'number' && index >= 0 && index < cards.length && !seen.has(index)) {
        seen.add(index);
        correct += 1;
      }
    }
  }

  const wrong = Math.max(0, maxScore - correct);
  return {
    score: timedOut ? 0 : correct,
    maxScore,
    correct: timedOut ? 0 : correct,
    wrong: timedOut ? maxScore : wrong,
    timedOut,
  };
}
