import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { CreatePostDto } from '../../posts/dto/create-post.dto';
import { MaxReadableLength } from '../../readable-length.validator';

/** A post, in a company's name or your own, and when to publish it. */
export class SchedulePostDto extends CreatePostDto {
  @IsISO8601()
  publishAt!: string;
}

/** A new time, new words, or both. Anything else means cancelling and scheduling again. */
export class UpdateScheduledPostDto {
  @IsOptional()
  @IsISO8601()
  publishAt?: string;

  @IsOptional()
  @IsString()
  @MaxReadableLength(5000)
  content?: string;
}
