import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VerificationStatus } from '@prisma/client';

export class ReviewVerificationDto {
  // A review can only resolve to APPROVED or REJECTED (not PENDING).
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status: typeof VerificationStatus.APPROVED | typeof VerificationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewerNote?: string;
}
