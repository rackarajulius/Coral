import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class MessageAttachmentDto {
  @IsString() @MaxLength(255) name: string;
  @IsString() @MaxLength(120) type: string;
  @IsString() @MaxLength(40) size: string;
  @IsString() @MaxLength(400) path: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
