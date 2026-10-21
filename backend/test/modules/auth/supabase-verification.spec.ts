import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../../../src/supabase/supabase.service';

describe('authentication provider failure classification', () => {
  const getUser = jest.fn();
  let service: SupabaseService;
  beforeEach(() => {
    getUser.mockReset();
    service = new SupabaseService({ get: jest.fn() } as unknown as ConfigService);
    (service as any).client = { auth: { getUser } };
  });
  it.each([400, 401, 403, 404, 422])('returns no identity on explicit rejection %i', async status => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status } });
    await expect(service.verifyToken('rejected')).resolves.toBeNull();
  });
  it.each([0, 429, 500, 503])('reports retryable provider failure %i and does not cache it', async status => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { status } })
      .mockResolvedValueOnce({ data: { user: { id: 'valid' } }, error: null });
    await expect(service.verifyTokenCached('valid')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.verifyTokenCached('valid')).resolves.toEqual({ id: 'valid' });
    expect(getUser).toHaveBeenCalledTimes(2);
  });
  it('does not disclose transport details or mark a transport exception as an invalid token', async () => {
    getUser.mockRejectedValue(new Error('private provider details'));
    await expect(service.verifyToken('valid')).rejects.toThrow('Authentication is temporarily unavailable');
  });
});
