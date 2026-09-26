import { Injectable } from '@nestjs/common';
import { PostsService } from '../posts/posts.service';
import { FeedQueryDto } from './dto/feed-query.dto';

@Injectable()
export class FeedService {
  constructor(private readonly postsService: PostsService) {}

  async getFeed(query: FeedQueryDto, userId?: string) {
    // Feed currently uses newest-first ranking. This can later evolve to a scored feed.
    return this.postsService.list(
      {
        page: query.page,
        limit: query.limit,
      },
      userId,
    );
  }
}
