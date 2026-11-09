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
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { MaxReadableLength } from '../../readable-length.validator';
import { Type } from 'class-transformer';
import { CommentPolicy, PostCtaLabel } from '@prisma/client';
import { CollaboratorRefDto } from '../../collaborators/collaborators.dto';
import { MAX_COLLABORATORS } from '../../collaborators/collaborator-rules';

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

/** A PDF uploaded through POST /community/posts/documents, and what to call it. */
export class PostDocumentDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;
}

/** A call-to-action bar under the post: a headline, a link, and a button from a fixed list. */
export class PostCtaDto {
  @IsEnum(PostCtaLabel)
  label!: PostCtaLabel;

  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  headline!: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsEnum(CommunityPostPurpose)
  purpose?: CommunityPostPurpose;

  /** Present when the post shares a document. It goes on its own: no pictures, video or poll. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PostDocumentDto)
  document?: PostDocumentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementReferenceDto)
  reference?: AnnouncementReferenceDto;

  /** Present when the post is a poll. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PollDto)
  poll?: PollDto;

  /**
   * The space the post is for, when it is for one.
   *
   * Optional, the way LinkedIn's audience is: without a space a post is for
   * everyone — Home, the author's followers, their profile or the company's
   * page. With one, the author becomes a member of it on posting.
   */
  @IsOptional()
  @IsUUID()
  spaceId?: string;

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
  @MaxReadableLength(5000)
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

  /** Who may comment: anyone (the default), followers only, or nobody. */
  @IsOptional()
  @IsEnum(CommentPolicy)
  commentPolicy?: CommentPolicy;

  /**
   * People and company pages invited to collaborate, as on LinkedIn: each is
   * asked, and shows on the post once they accept. Up to five.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COLLABORATORS)
  @ValidateNested({ each: true })
  @Type(() => CollaboratorRefDto)
  collaborators?: CollaboratorRefDto[];

  /** A call-to-action bar, as on LinkedIn's sponsored posts. Not on a poll, or a post linking a listing. */
  @IsOptional()
  @ValidateNested()
  @Type(() => PostCtaDto)
  cta?: PostCtaDto;
}
