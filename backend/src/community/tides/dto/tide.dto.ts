import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TideMode, TideRsvp } from '@prisma/client';

/**
 * An IANA zone, loosely shaped.
 *
 * Not validated against the full tz database here — that list changes with the
 * world, and rejecting a newly-added zone would be worse than accepting a
 * malformed one the client never sends.
 */
const IANA_ZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$|^UTC$/;

export class CreateTideDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /** The instant it starts, in UTC. */
  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  /** The host's zone, e.g. "Africa/Kampala". Kept beside the instant. */
  @Matches(IANA_ZONE, { message: 'Give a time zone like "Africa/Kampala".' })
  @MaxLength(64)
  timezone!: string;

  @IsEnum(TideMode)
  mode!: TideMode;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  /** The way in. Never served publicly — see TidesService. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  joinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string;

  /** Omit for no limit. A number given here is enforced. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  capacity?: number;

  /**
   * Hold it in the company's name. A request, not a company id — the server
   * decides whether the caller may and which company, as for posts.
   */
  @IsOptional()
  @IsBoolean()
  asCompany?: boolean;

  /**
   * The space to announce it in, when it is for one.
   *
   * A tide is always announced — one nobody is told about is one nobody
   * comes to, and the post is how it reaches the feed. Without a space the
   * announcement is for everyone; with one, the host joins it.
   */
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  /** The words on that announcement. The tide's own details are not repeated. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  announcement?: string;
}

export class UpdateTideDto {
  @IsOptional() @IsString() @MaxLength(140) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
  @IsOptional() @Matches(IANA_ZONE) @MaxLength(64) timezone?: string;
  @IsOptional() @IsEnum(TideMode) mode?: TideMode;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
  @IsOptional() @IsString() @MaxLength(2048) joinUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) bannerUrl?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) capacity?: number;
}

export class CancelTideDto {
  /**
   * Why. Optional, but it is what the people who cleared their afternoon
   * actually want to know.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RsvpDto {
  @IsEnum(TideRsvp)
  status!: TideRsvp;
}

export class ListTidesQueryDto {
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() past?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit?: number;
}
