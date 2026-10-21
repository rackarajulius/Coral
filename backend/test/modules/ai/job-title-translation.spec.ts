import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../src/services/ai/ai.service';

/** An AiService whose Gemini answers `answer`, and the fetch spy it went through. */
function withGeminiAnswer(answer: unknown) {
  const fetch = jest.spyOn(global, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] })),
  );
  const ai = new AiService(
    new ConfigService({ GEMINI_API_KEY: 'key', GEMINI_MODEL: 'gemini-2.5-flash', AI_PROVIDER: 'gemini', AI_FALLBACK: 'false' }),
  );
  return { ai, fetch };
}

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('job titles in another language', () => {
  it('sends only the title and the language, without reasoning, and reads the answer', async () => {
    const { ai, fetch } = withGeminiAnswer({ title: '  Pflegefachkraft ' });
    await expect(ai.translateJobTitle('nurse', 'German')).resolves.toBe('Pflegefachkraft');

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
      generationConfig: Record<string, unknown>;
    };
    expect(body.contents.map((c) => c.parts.map((p) => p.text).join('')).join('')).toContain('{"title":"nurse","language":"German"}');
    expect(body.generationConfig).toMatchObject({ temperature: 0, thinkingConfig: { thinkingBudget: 0 } });
  });

  it.each([
    ['nothing', { title: '' }],
    ['not a string', { title: 42 }],
    ['a paragraph', { title: 'x'.repeat(81) }],
    ['markup', { title: '<b>Pflegefachkraft</b>' }],
  ])('refuses an answer that is %s', async (_, answer) => {
    const { ai } = withGeminiAnswer(answer);
    await expect(ai.translateJobTitle('nurse', 'German')).rejects.toThrow('Unusable job title translation');
  });
});
