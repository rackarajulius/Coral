import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePortfolioItemDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mediaType?: string; // video, document, project, design

  @IsOptional()
  @IsString()
  description?: string;

  // Plain strings rather than @IsUrl: a link typed without a scheme is still
  // usable, and the client adds one when opening it. Bounded because images
  // used to arrive base64-encoded in this field, megabytes at a time.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  projectUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;
}

export class UpdatePortfolioItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mediaType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  projectUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;
}
