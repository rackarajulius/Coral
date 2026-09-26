import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecommendationDto {
  @IsString()
  @MaxLength(255)
  author: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authorTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  relationship?: string;

  @IsString()
  @MaxLength(5000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  date?: string;
}

export class UpdateRecommendationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  authorTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  date?: string;
}
