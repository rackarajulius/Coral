import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AiService } from '../../../src/services/ai/ai.service';
import { RoleTranslationService } from '../../../src/resume-matcher/role-translation.service';

describe('RoleTranslationService', () => {
  const translateJobTitle = jest.fn();
  const table = { findUnique: jest.fn(), upsert: jest.fn() };
  const service = () =>
    new RoleTranslationService(
      { translateJobTitle } as unknown as AiService,
      { roleTranslation: table } as unknown as PrismaService,
    );

  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.resetAllMocks();
    table.findUnique.mockResolvedValue(null);
    table.upsert.mockResolvedValue({});
    translateJobTitle.mockResolvedValue('Pflegefachkraft');
  });

  it('asks the AI once, keeps the answer, and answers from memory after', async () => {
    const translations = service();
    await expect(translations.localTitle('  Nurse ', 'de')).resolves.toBe('Pflegefachkraft');
    await expect(translations.localTitle('nurse', 'de')).resolves.toBe('Pflegefachkraft');

    expect(translateJobTitle).toHaveBeenCalledTimes(1);
    expect(translateJobTitle).toHaveBeenCalledWith('nurse', 'German');
    expect(table.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { role: 'nurse', language: 'de', title: 'Pflegefachkraft' },
    }));
    expect(table.findUnique).toHaveBeenCalledTimes(1);
  });

  it('reads a kept answer without asking the AI', async () => {
    table.findUnique.mockResolvedValue({ title: 'infirmier' });
    await expect(service().localTitle('Nurse', 'fr')).resolves.toBe('infirmier');
    expect(translateJobTitle).not.toHaveBeenCalled();
  });

  it('has nothing to add where ads use the role as it is, and remembers that too', async () => {
    translateJobTitle.mockResolvedValue('Accountant');
    const translations = service();
    await expect(translations.localTitle('accountant', 'nl')).resolves.toBeUndefined();
    await expect(translations.localTitle('accountant', 'nl')).resolves.toBeUndefined();
    expect(translateJobTitle).toHaveBeenCalledTimes(1);
    expect(table.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { role: 'accountant', language: 'nl', title: 'Accountant' } }));
  });

  it('shares one question between searches that arrive together', async () => {
    const translations = service();
    await Promise.all([translations.localTitle('nurse', 'de'), translations.localTitle('Nurse', 'de')]);
    expect(translateJobTitle).toHaveBeenCalledTimes(1);
  });

  it('never throws, keeps no failure, and pauses every new title for a while after one fails', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    translateJobTitle.mockRejectedValueOnce(new Error('quota'));
    const translations = service();

    await expect(translations.localTitle('nurse', 'de')).resolves.toBeUndefined();
    await expect(translations.localTitle('nurse', 'de')).resolves.toBeUndefined();
    await expect(translations.localTitle('welder', 'fr')).resolves.toBeUndefined();
    expect(translateJobTitle).toHaveBeenCalledTimes(1);
    expect(table.upsert).not.toHaveBeenCalled();

    // A title already kept is still used meanwhile.
    table.findUnique.mockResolvedValueOnce({ title: 'infirmier' });
    await expect(translations.localTitle('nurse', 'fr')).resolves.toBe('infirmier');

    now.mockReturnValue(1_000_000 + 11 * 60_000);
    await expect(translations.localTitle('nurse', 'de')).resolves.toBe('Pflegefachkraft');
    expect(translateJobTitle).toHaveBeenCalledTimes(2);
  });

  it('does not pause when only the table could not be read', async () => {
    table.findUnique.mockRejectedValueOnce(new Error('db down'));
    const translations = service();
    await expect(translations.localTitle('nurse', 'de')).resolves.toBeUndefined();
    await expect(translations.localTitle('nurse', 'de')).resolves.toBe('Pflegefachkraft');
  });

  it('still answers when the answer could not be kept', async () => {
    table.upsert.mockRejectedValue(new Error('db down'));
    await expect(service().localTitle('nurse', 'de')).resolves.toBe('Pflegefachkraft');
  });
});
