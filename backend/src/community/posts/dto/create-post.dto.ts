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
   * A request, not an instruction: the server decides whether the caller may
   * speak for a company, and which one. Nothing here names the company, so a
   * caller cannot post as somebody else's.
   */
  @IsOptional()
  @IsBoolean()
  asCompany?: boolean;

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
