import { IsOptional, IsString, IsUUID } from 'class-validator';
import { MaxReadableLength } from '../../readable-length.validator';

export class CreateCommentDto {
  @IsString()
  @MaxReadableLength(2000)
  content: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
