import { analyzeDeterministic } from './deterministic-lesson-analyzer';
import { normalizeProviderAnalysis } from './openai-compatible-analyzer';

const FIXTURE = `# متغیر

یک متغیر نامی برای یک مقدار است.

\`\`\`js
const count = 1;
\`\`\`

## نکته

- اول
- دوم
`;

describe('DeterministicLessonAnalyzer', () => {
  it('segments a stored lesson into grounded scenes', () => {
    const result = analyzeDeterministic({
      title: 'متغیرها',
      content: FIXTURE,
      courseTitle: 'جاوااسکریپت',
      courseDescription: 'مبانی',
    });

    expect(result.providerId).toBe('deterministic');
    expect(result.tokens).toBe(0);
    expect(result.concepts).toEqual(expect.arrayContaining(['متغیر', 'نکته']));
    expect(result.scenes.length).toBeGreaterThanOrEqual(3);
    for (const scene of result.scenes) {
      expect(scene.sourceStart).toBeGreaterThanOrEqual(0);
      expect(scene.sourceEnd).toBeLessThanOrEqual(FIXTURE.length);
      expect(scene.sourceStart).toBeLessThanOrEqual(scene.sourceEnd);
    }
    const codeScene = result.scenes.find((scene) => scene.code.includes('const count = 1'));
    expect(codeScene).toBeTruthy();
    expect(codeScene?.animationType).toBe('code');
    expect(codeScene?.codeSource).toBe('lesson');
    expect(codeScene?.code).not.toMatch(/broken|TODO|lorem/i);
    const narration = result.scenes.map((scene) => scene.narration).join('\n');
    expect(narration).toContain('یک متغیر نامی برای یک مقدار است.');
  });

  it('warns on empty content and does not invent scenes', () => {
    const result = analyzeDeterministic({
      title: 'خالی',
      content: '   \n',
      courseTitle: 'دوره',
      courseDescription: '',
    });
    expect(result.scenes).toHaveLength(0);
    expect(result.warnings.map((warning) => warning.code)).toContain('empty_content');
  });

  it('warns when the same heading is defined twice with different text', () => {
    const content = `# قانون

همیشه از const استفاده کن.

# قانون

هرگز از const استفاده نکن.
`;
    const result = analyzeDeterministic({
      title: 'قانون',
      content,
      courseTitle: 'دوره',
      courseDescription: '',
    });
    expect(result.warnings.map((warning) => warning.code)).toContain('duplicate_heading');
  });
});

describe('normalizeProviderAnalysis', () => {
  it('drops code that is not in the lesson and keeps grounded narration', () => {
    const content = 'یک متغیر نام است.\n\nconst count = 1;';
    const result = normalizeProviderAnalysis(
      {
        concepts: ['متغیر'],
        warnings: [],
        scenes: [
          {
            title: 'تعریف',
            narration: 'یک متغیر نام است.',
            narrationEn: '',
            onScreenText: 'متغیر',
            durationSec: 5,
            animationType: 'kinetic',
            code: 'const invented = oops(',
            codeLanguage: 'js',
            sourceStart: 0,
            sourceEnd: 18,
          },
        ],
      },
      { title: 'درس', content, courseTitle: 'دوره', courseDescription: '' },
    );
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0]?.code).toBe('');
    expect(result.warnings.map((warning) => warning.code)).toContain('provider_code_rejected');
  });

  it('fails when nothing is grounded in the lesson', () => {
    expect(() =>
      normalizeProviderAnalysis(
        {
          scenes: [
            {
              narration: 'this sentence is not in the lesson',
              code: 'nope()',
              sourceStart: 0,
              sourceEnd: 1,
            },
          ],
        },
        { title: 'درس', content: 'متن واقعی درس', courseTitle: 'دوره', courseDescription: '' },
      ),
    ).toThrow(/no usable scenes/);
  });
});
