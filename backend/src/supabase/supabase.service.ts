import { createHash } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * How long a token Supabase has accepted is trusted without asking again.
 *
 * This is the most a revocation can lag: a session signed out elsewhere, a
 * Supabase ban, or a second factor enrolled on another session keeps working
 * for up to this long. Our own suspension check reads the database on every
 * request and is not affected.
 */
export const VERIFIED_TOKEN_TTL_MS = 30_000;
const VERIFIED_TOKEN_MAX_ENTRIES = 10_000;

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;
  /** sha256(token) → the user Supabase returned, until `until`. */
  private readonly verified = new Map<string, { user: User; until: number }>();
  /** Checks already on their way to Supabase, so a page's parallel requests share one. */
  private readonly inFlight = new Map<string, Promise<User | null>>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase configuration missing. Authentication will not work properly.');
      return;
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  /**
   * Get the Supabase client instance
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Verify a JWT token and return the user
   * @param token - The JWT token to verify
   * @returns The user object if valid, null otherwise
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const { data, error } = await this.client.auth.getUser(token);

      if (error) {
        console.error('Token verification error:', error.message);
        return null;
      }

      return data.user;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Like `verifyToken`, but remembers an accepted token for a short while.
   *
   * Asking Supabase takes a network round trip, and a single page load sends
   * several requests with the same token. Only successful answers are kept —
   * a failure might be Supabase being unreachable, not a bad token — and never
   * past the token's own expiry. Keyed by a hash of the exact token, so only
   * the holder of that token can be answered from here.
   */
  async verifyTokenCached(token: string): Promise<User | null> {
    const key = createHash('sha256').update(token).digest('base64url');
    const hit = this.verified.get(key);
    if (hit) {
      if (hit.until > Date.now()) return hit.user;
      this.verified.delete(key);
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const check = this.verifyToken(token)
      .then((user) => {
        if (user) {
          const until = Math.min(Date.now() + VERIFIED_TOKEN_TTL_MS, this.expiryOf(token));
          if (until > Date.now()) this.remember(key, user, until);
        }
        return user;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, check);
    return check;
  }

  /** Forgets every remembered token (tests, and anything that must re-check now). */
  forgetVerifiedTokens(): void {
    this.verified.clear();
  }

  private remember(key: string, user: User, until: number): void {
    if (this.verified.size >= VERIFIED_TOKEN_MAX_ENTRIES) {
      const now = Date.now();
      for (const [k, v] of this.verified) if (v.until <= now) this.verified.delete(k);
      // Still full: drop the oldest entries (a Map iterates in insertion order).
      for (const k of this.verified.keys()) {
        if (this.verified.size < VERIFIED_TOKEN_MAX_ENTRIES) break;
        this.verified.delete(k);
      }
    }
    this.verified.set(key, { user, until });
  }

  /**
   * The token's `exp`, in ms. Read without checking the signature — Supabase
   * has just accepted this exact token. Unreadable means "don't remember it".
   */
  private expiryOf(token: string): number {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
        exp?: unknown;
      };
      return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get user by ID
   * @param userId - The Supabase user ID
   * @param token - The JWT token for authorization
   */
  async getUserById(userId: string, token: string): Promise<User | null> {
    try {
      const { data, error } = await this.client.auth.admin.getUserById(userId);

      if (error) {
        console.error('Get user error:', error.message);
        return null;
      }

      return data.user;
    } catch (error) {
      console.error('Get user failed:', error);
      return null;
    }
  }

  /**
   * Validate that a token belongs to a specific user
   * @param token - The JWT token
   * @param userId - The expected user ID
   */
  async validateUserToken(token: string, userId: string): Promise<boolean> {
    const user = await this.verifyToken(token);
    return user?.id === userId;
  }
}