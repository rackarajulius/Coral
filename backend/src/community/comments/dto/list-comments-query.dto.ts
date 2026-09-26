import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListCommentsQueryDto {
  /**
   * 'newest' (default), 'oldest', or 'replies'.
   *
   * There is deliberately no "top": comments carry no likes, so ranking by
   * popularity would have nothing behind it. Most-replied is the honest
   * version of the same idea — it measures what people actually engaged with.
   */
  @IsOptional()
  @IsIn(['newest', 'oldest', 'replies'])
  sort?: 'newest' | 'oldest' | 'replies';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

