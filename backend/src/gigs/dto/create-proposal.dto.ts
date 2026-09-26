import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  coverLetter: string;

  @IsInt()
  @Min(1)
  bidAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  estimatedDuration?: string;
}

