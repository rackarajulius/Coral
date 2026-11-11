import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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
   * Which side of the community to show: people offering (their work and
   * services) or people asking (open projects and live jobs). Absent means
   * every post.
   */
  @IsOptional()
  @IsIn(['showcase', 'opportunity'])
  section?: 'showcase' | 'opportunity';

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

  /**
   * A tab of someone's page (with `authorId`): only what has pictures, video
   * or a document; or only the posts they collaborate on. Absent, everything.
   */
  @IsOptional()
  @IsIn(['media', 'collaborations'])
  view?: 'media' | 'collaborations';

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  hashtag?: string;
}

/** A slice of the feed, and the time of the newest post the reader already has. */
export class NewPostsQueryDto extends ListPostsQueryDto {
  @IsISO8601()
  after!: string;
}
