import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveCompanyStepDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  companyWebsite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  headquarters?: string;

  @IsOptional() @IsBoolean() isRecruiter?: boolean;
  @IsOptional() @IsBoolean() isHiringManager?: boolean;
  @IsOptional() @IsBoolean() isAdmin?: boolean;

  /**
   * Join an existing company instead of creating a parallel one. Validated
   * server-side against the caller's work-email domain — an id alone is not
   * permission to attach yourself to a company.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  joinCompanyId?: string;
}
