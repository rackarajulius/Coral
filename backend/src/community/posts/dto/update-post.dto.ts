import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnnouncementReferenceDto, CommunityPostPurpose, CommunityPostType } from './create-post.dto';

export class UpdatePostDto {
  @IsOptional()
  @IsEnum(CommunityPostPurpose)
  purpose?: CommunityPostPurpose;

  /** Explicit null detaches the reference; omitted retains it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementReferenceDto)
  reference?: AnnouncementReferenceDto | null;

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
