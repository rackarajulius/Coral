import { CompanyRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class InviteMemberDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email!: string;

  @IsEnum(CompanyRole)
  role!: CompanyRole;
}

export class SetMemberRoleDto {
  @IsEnum(CompanyRole)
  role!: CompanyRole;
}

export class ApproveMemberDto {
  /** Optional override — approving keeps the requested role when omitted. */
  @IsOptional()
  @IsEnum(CompanyRole)
  role?: CompanyRole;
}
