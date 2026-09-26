import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListGigsQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class CreateGigDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

