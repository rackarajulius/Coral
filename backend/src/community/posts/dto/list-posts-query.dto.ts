import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListPostsQueryDto {
  /**
   * Posts published in this company's name.
   *
   * Only ever official posts — an employee's personal post is not the
   * company's to republish, whatever their badge says.
   */
  @IsOptional()
  @IsUUID()
  companyId?: string;

  /**
   * Which slice of the feed. Absent means everything.
   * 'my-spaces' needs the spaces you joined, 'following' the people and
   * companies you follow; the rest need your id.
   */
  @IsOptional()
  @IsIn(['saved', 'liked', 'mine', 'my-spaces', 'following'])
  filter?: 'saved' | 'liked' | 'mine' | 'my-spaces' | 'following';

  /**
   * What the posts are for, as the community's sections group them: talk
   * (general posts and questions), work people are showing, or things on
   * offer (open projects, live jobs, services). Absent means all of them.
   */
  @IsOptional()
  @IsIn(['discussion', 'showcase', 'opportunity'])
  section?: 'discussion' | 'showcase' | 'opportunity';

  /** 'new' (default) or 'top'. */
  @IsOptional()
  @IsIn(['new', 'top'])
  sort?: string;

  /** Narrows the feed to one space. Absent means every space. */
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  hashtag?: string;
}

