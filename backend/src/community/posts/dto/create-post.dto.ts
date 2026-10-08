import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  IsISO8601,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CommunityPostType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  JOB = 'JOB',
  CAROUSEL = 'CAROUSEL',
  POLL = 'POLL',
}

/** Purpose is separate from the media format of a post. */
export enum CommunityPostPurpose {
  GENERAL = 'general',
  QUESTION = 'question',
  SHOWCASE = 'showcase',
  SERVICE_ANNOUNCEMENT = 'service_announcement',
  OPPORTUNITY = 'opportunity',
}

export enum AnnouncementReferenceType {
  SERVICE = 'service',
  PROJECT = 'project',
  JOB = 'job',
}

export class AnnouncementReferenceDto {
  @IsEnum(AnnouncementReferenceType)
  type!: AnnouncementReferenceType;

  @IsUUID()
  id!: string;
}

export class PollDto {
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options!: string[];

  @IsOptional()
  @IsISO8601()
  closesAt?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsEnum(CommunityPostPurpose)
  purpose?: CommunityPostPurpose;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementReferenceDto)
  reference?: AnnouncementReferenceDto;

  /** Present when the post is a poll. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PollDto)
  poll?: PollDto;

  /** Which space the post belongs to. Required for new posts. */
  @IsUUID()
  spaceId!: string;

  /**
   * Post for the company rather than for yourself.
   *
   * The server verifies current company publishing authority. Without an
   * explicit companyId, the existing primary-company selection is retained.
   */
  @IsOptional()
  @IsBoolean()
  asCompany?: boolean;

  /** Optional company choice, accepted only when asCompany is true. */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(CommunityPostType)
  postType?: CommunityPostType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  hashtags?: string[];
}
