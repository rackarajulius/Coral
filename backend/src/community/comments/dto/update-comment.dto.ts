import { IsString } from 'class-validator';
import { MaxReadableLength } from '../../readable-length.validator';

export class UpdateCommentDto {
  @IsString()
  @MaxReadableLength(2000)
  content: string;
}

