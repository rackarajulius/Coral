import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../src/supabase/supabase.service';
import { StorageService } from '../../../src/storage/storage.service';

describe('account closure authentication cache', () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;

  it('does not repopulate the accepted-token cache from verification already in flight at deletion', async () => {
    const service = new SupabaseService({ get: jest.fn() } as unknown as ConfigService);
    let resolve!: (value: any) => void;
    const pending = new Promise<any>((finish) => { resolve = finish; });
    const verify = jest.spyOn(service, 'verifyToken').mockReturnValueOnce(pending).mockResolvedValue(null);
    const oldCheck = service.verifyTokenCached(token);
    service.forgetVerifiedTokens();
    resolve({ id: 'deleted-identity' });
    await oldCheck;
    await expect(service.verifyTokenCached(token)).resolves.toBeNull();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('clears accepted tokens after deleting the auth identity', async () => {
    const service = new SupabaseService({ get: jest.fn() } as unknown as ConfigService);
    (service as any).adminClient = { auth: { admin: { deleteUser: jest.fn().mockResolvedValue({ error: null }) } } };
    const verify = jest.spyOn(service, 'verifyToken').mockResolvedValueOnce({ id: 'deleted-identity' } as any).mockResolvedValue(null);
    await service.verifyTokenCached(token);
    await service.deleteAuthUser('deleted-identity');
    await expect(service.verifyTokenCached(token)).resolves.toBeNull();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('reconciles a lost deletion response when the privileged identity lookup confirms absence', async () => {
    const service = new SupabaseService({ get: jest.fn() } as unknown as ConfigService);
    const lookup = jest.fn().mockResolvedValue({ data: { user: null }, error: { code: 'user_not_found' } });
    (service as any).adminClient = { auth: { admin: {
      deleteUser: jest.fn().mockRejectedValue(new Error('response lost')), getUserById: lookup,
    } } };
    await expect(service.deleteAuthUser('deleted-identity')).resolves.toBeUndefined();
    expect(lookup).toHaveBeenCalledWith('deleted-identity');
  });

  it('returns a safe error if deletion fails and the identity still exists', async () => {
    const service = new SupabaseService({ get: jest.fn() } as unknown as ConfigService);
    (service as any).adminClient = { auth: { admin: {
      deleteUser: jest.fn().mockResolvedValue({ error: { code: 'internal_error', message: 'private detail' } }),
      getUserById: jest.fn().mockResolvedValue({ data: { user: { id: 'identity' } }, error: null }),
    } } };
    await expect(service.deleteAuthUser('identity')).rejects.toThrow('Account closure could not reach the authentication provider');
  });
});

describe('strict account storage cleanup', () => {
  let storage: StorageService;
  let list: jest.Mock;
  let remove: jest.Mock;
  beforeEach(() => {
    storage = new StorageService({ get: jest.fn() } as unknown as ConfigService);
    list = jest.fn();
    remove = jest.fn().mockResolvedValue({ error: null });
    (storage as any).client = { storage: { from: jest.fn().mockReturnValue({ list, remove }) } };
  });

  it('lists all pages before deleting, and scopes shared folder removal to this user', async () => {
    const entries = Array.from({ length: 151 }, (_, index) => ({ name: `${index === 150 ? 'other' : 'candidate'}-${index}.png`, id: `file-${index}` }));
    list.mockImplementation(async (_prefix: string, { offset, limit }: { offset: number; limit: number }) => ({ data: entries.slice(offset, offset + limit) }));
    await storage.deleteFilesUnder('avatars', 'profile-media', 'candidate-');
    expect(list).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls.flatMap((call) => call[0])).toHaveLength(150);
    expect(remove.mock.calls.flatMap((call) => call[0])).not.toContain('avatars/other-150.png');
    expect(Math.max(...list.mock.invocationCallOrder)).toBeLessThan(Math.min(...remove.mock.invocationCallOrder));
  });

  it('collects nested folders before any removal can shift parent pagination', async () => {
    const folders = Array.from({ length: 101 }, (_, index) => ({ name: `folder-${index}`, id: null }));
    list.mockImplementation(async (prefix: string, { offset, limit }: { offset: number; limit: number }) => ({
      data: prefix === 'own' ? folders.slice(offset, offset + limit) : [{ name: 'file', id: 'object' }],
    }));
    await storage.deleteFilesUnder('own', 'private');
    expect(remove.mock.calls.flatMap((call) => call[0])).toHaveLength(101);
    expect(Math.max(...list.mock.invocationCallOrder)).toBeLessThan(Math.min(...remove.mock.invocationCallOrder));
  });

  it('does not silently accept a failed list or remove', async () => {
    list.mockResolvedValueOnce({ error: { message: 'internal provider detail' } });
    await expect(storage.deleteFilesUnder('own', 'private')).rejects.toThrow('Account file cleanup failed');
    expect(remove).not.toHaveBeenCalled();
    list.mockResolvedValueOnce({ data: [{ name: 'file', id: 'object' }] });
    remove.mockResolvedValueOnce({ error: { message: 'internal provider detail' } });
    await expect(storage.deleteFilesUnder('own', 'private')).rejects.toThrow('Account file cleanup failed');
  });
});
