import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth.service';

/**
 * Set on a request once this guard has run for it.
 *
 * The guard is registered app-wide AND repeated with `@UseGuards(JwtAuthGuard)`
 * on many routes, so it ran twice per request — two Supabase checks and two
 * database round trips for the same token. The second run now returns at once.
 */
const AUTH_CHECKED = Symbol('jwtAuthGuard.checked');

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private supabaseService: SupabaseService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    if (request[AUTH_CHECKED]) {
      return true;
    }
    const token = this.extractTokenFromHeader(request);

    /**
     * Public means "a session is not required", not "a session is ignored".
     *
     * A public route still has to know who is asking when someone is signed
     * in: the community feed reports whether *you* liked a post, the space
     * list whether *you* are a member, and the personal slices are about you
     * by definition. Returning early here left `request.user` unset even with
     * a valid token, so every one of those quietly answered as if nobody was
     * there.
     *
     * A bad or expired token is not an error on these routes — it just means
     * the reader is anonymous, which they were entitled to be anyway.
     */
    if (isPublic) {
      if (token) {
        try {
          const supabaseUser = await this.supabaseService.verifyTokenCached(token);
          if (supabaseUser) {
            const user = await this.authService.findOrCreateUser(supabaseUser, async () =>
              (await this.supabaseService.verifyToken(token))?.id === supabaseUser.id);
            if (user.status !== 'SUSPENDED' && user.status !== 'BANNED') {
              request.user = user;
            }
          }
        } catch (error) {
          this.logger.debug(
            `Ignoring token on public route: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }
      }
      request[AUTH_CHECKED] = true;
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify token with Supabase (remembered briefly — see VERIFIED_TOKEN_TTL_MS)
      const supabaseUser = await this.supabaseService.verifyTokenCached(token);

      if (!supabaseUser) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Get or create user in our database
      const user = await this.authService.findOrCreateUser(supabaseUser, async () =>
        (await this.supabaseService.verifyToken(token))?.id === supabaseUser.id);

      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedException('Your account has been suspended');
      }

      if (user.status === 'BANNED') {
        throw new UnauthorizedException('Your account has been banned');
      }

      this.assertSecondFactorCleared(token, supabaseUser);

      // Attach user to request
      request.user = user;
      request[AUTH_CHECKED] = true;

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Authentication failed: ${errorMessage}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Rejects a session that hasn't cleared its second factor.
   *
   * Enrolling in 2FA is meaningless without this. Supabase issues a working
   * access token straight after the password step and only raises it to `aal2`
   * once a code is verified — so a stolen password still buys full API access
   * unless the level is checked on every request.
   *
   * Accounts with no verified factor are untouched: `factors` is empty, and the
   * check returns immediately.
   */
  private assertSecondFactorCleared(token: string, supabaseUser: { factors?: unknown }): void {
    const factors = (supabaseUser.factors ?? []) as { status?: string }[];
    const hasVerifiedFactor = factors.some((f) => f?.status === 'verified');
    if (!hasVerifiedFactor) {
      return;
    }

    const aal = this.readClaim(token, 'aal');
    if (aal !== 'aal2') {
      throw new UnauthorizedException('Two-factor verification required');
    }
  }

  /**
   * Reads a claim from an already-verified token.
   *
   * Decode only — `verifyToken` has authenticated the token against Supabase
   * before this runs, so this never decides authenticity, only which level the
   * authenticated session reached. A malformed payload is treated as missing,
   * which fails closed at the caller.
   */
  private readClaim(token: string, claim: string): string | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const decoded = JSON.parse(
        Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      ) as Record<string, unknown>;
      const value = decoded[claim];
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers?.authorization;
    if (!authorization) return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
