import 'reflect-metadata';
import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { AuthService } from '../../../src/auth/auth.service';
import { IS_PUBLIC_KEY } from '../../../src/common/decorators/public.decorator';
import { SupabaseService } from '../../../src/supabase/supabase.service';

describe('JWT authentication boundary', () => {
  const verify = jest.fn();
  const findUser = jest.fn();
  let guard: JwtAuthGuard;

  beforeEach(() => {
    verify.mockReset().mockResolvedValue({ id: 'identity', factors: [] });
    findUser.mockReset().mockResolvedValue({ id: 'candidate', status: 'ACTIVE' });
    guard = new JwtAuthGuard(new Reflector(),
      { verifyTokenCached: verify } as unknown as SupabaseService,
      { findOrCreateUser: findUser } as unknown as AuthService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  function context(token?: string, isPublic = false) {
    const handler = () => undefined;
    if (isPublic) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    const request: { headers: Record<string, string>; user?: { id: string } } = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const execution = {
      getHandler: () => handler, getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, execution };
  }

  it('requires a token on protected routes', async () => {
    await expect(guard.canActivate(context().execution)).rejects.toThrow(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid token without looking up a database user', async () => {
    verify.mockResolvedValue(null);
    await expect(guard.canActivate(context('invalid').execution)).rejects.toThrow(UnauthorizedException);
    expect(findUser).not.toHaveBeenCalled();
  });

  it.each(['BANNED', 'SUSPENDED'])('refuses a %s account even with a valid token', async (status) => {
    findUser.mockResolvedValue({ id: 'candidate', status });
    await expect(guard.canActivate(context('valid').execution)).rejects.toThrow(UnauthorizedException);
  });

  it('runs duplicate guard registrations only once per request', async () => {
    const { execution, request } = context('valid');
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.user?.id).toBe('candidate');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(findUser).toHaveBeenCalledTimes(1);
  });

  it('allows an expired session to browse public routes anonymously', async () => {
    verify.mockResolvedValue(null);
    const { execution, request } = context('expired', true);
    await expect(guard.canActivate(execution)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('requires the second factor for enrolled accounts', async () => {
    verify.mockResolvedValue({ id: 'identity', factors: [{ status: 'verified' }] });
    const token = (aal: string) => `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;
    await expect(guard.canActivate(context(token('aal1')).execution)).rejects.toThrow('Two-factor verification required');
    await expect(guard.canActivate(context(token('aal2')).execution)).resolves.toBe(true);
  });
});
