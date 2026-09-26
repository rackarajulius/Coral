import { Injectable, NotImplementedException } from '@nestjs/common';
import { CreateGigDto, ListGigsQueryDto } from './dto/gig.dto';

@Injectable()
export class GigsService {
  listGigs(query: ListGigsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    return {
      data: [],
      meta: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      message: 'Gigs module scaffolded. Full persistence is pending gigs schema implementation.',
    };
  }

  getGigById(id: string) {
    return {
      id,
      message: 'Gigs module scaffolded. Full persistence is pending gigs schema implementation.',
    };
  }

  createGig(_userId: string, _dto: CreateGigDto) {
    throw new NotImplementedException(
      'Create gig is planned in backend-architecture.md after gigs tables are added to Prisma schema.',
    );
  }
}

