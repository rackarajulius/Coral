import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class StartWorkEmailDto {
  @IsString()
  experienceId: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email: string;
}

export class ConfirmWorkEmailDto {
  @IsString()
  experienceId: string;

  /** Six digits. Anything else never matched a code we issued. */
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code: string;
}
