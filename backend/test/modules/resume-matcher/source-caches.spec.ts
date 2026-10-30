import { ConfigService } from '@nestjs/config';
import { AdzunaJobSource } from '../../../src/resume-matcher/job-sources/adzuna.source';
import { cachedBoardJson, clearBoardCopies } from '../../../src/resume-matcher/job-sources/types';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/** Lets a download that already has its answer finish. */
const settle = () => new Promise((done) => setTimeout(done, 20));

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('job boards, as searches read them', () => {
  const url = 'https://boards.example/acme';
  beforeEach(() => clearBoardCopies());

  it('stops waiting for a slow board after six seconds, and the next search has it', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    let answer!: (response: Response) => void;
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(() => new Promise((done) => (answer = done)));

    const first = expect(cachedBoardJson(url)).rejects.toThrow('still downloading');
    await jest.advanceTimersByTimeAsync(6000);
    await first;

    answer(json({ jobs: ['slow but here'] }));
    jest.useRealTimers();
    await settle();
    await expect(cachedBoardJson(url)).resolves.toEqual({ jobs: ['slow but here'] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses a copy at once, and refreshes it behind the search once ten minutes old', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ v: 1 }))
      .mockResolvedValueOnce(json({ v: 2 }));

    await expect(cachedBoardJson(url)).resolves.toEqual({ v: 1 });
    await expect(cachedBoardJson(url)).resolves.toEqual({ v: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 10 * 60_000);
    await expect(cachedBoardJson(url)).resolves.toEqual({ v: 1 });
    await settle();
    await expect(cachedBoardJson(url)).resolves.toEqual({ v: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps its copy when a refresh fails', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ v: 1 }))
      .mockResolvedValueOnce(new Response('down', { status: 503 }));
    await cachedBoardJson(url);

    now.mockReturnValue(1_000_000 + 10 * 60_000);
    await cachedBoardJson(url);
    await settle();
    await expect(cachedBoardJson(url)).resolves.toEqual({ v: 1 });
  });

  it('skips a board that failed for two minutes, then tries it again', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response('gone', { status: 404 }));

    await expect(cachedBoardJson(url)).rejects.toThrow('HTTP 404');
    await expect(cachedBoardJson(url)).rejects.toThrow('HTTP 404');
    expect(fetch).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 2 * 60_000);
    await expect(cachedBoardJson(url)).rejects.toThrow('HTTP 404');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('Adzuna results', () => {
  const adzuna = () => new AdzunaJobSource(new ConfigService({ ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key' }));

  it('are kept for the same search, however it is typed, and asked again for another', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => json({ results: [{ id: '1', title: 'Engineer', company: { display_name: 'Acme' } }] }));
    const source = adzuna();

    const first = await source.search({ query: 'Software Engineer', location: 'Toronto', limit: 15 });
    const again = await source.search({ query: ' software  ENGINEER', location: 'toronto ', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(again).toEqual(first);

    await source.search({ query: 'Designer', location: 'Toronto', limit: 15 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
