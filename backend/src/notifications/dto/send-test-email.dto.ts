import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestEmailDto {
  @IsEmail()
  to: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}
