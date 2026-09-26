import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateContractDto {
  @IsOptional()
  @IsUUID()
  gigId?: string;

  @IsOptional()
  @IsUUID()
  proposalId?: string;

  @IsUUID()
  freelancerId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

