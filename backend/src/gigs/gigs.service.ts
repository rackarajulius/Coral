import { Injectable } from '@nestjs/common';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { CreateGigDto, ListGigsQueryDto } from './dto/gig.dto';

@Injectable()
export class GigsService {
  constructor(private readonly marketplace: MarketplaceService) {}
  listGigs(query: ListGigsQueryDto) { return this.marketplace.list('project', query); }
  getGigById(id: string) { return this.marketplace.getPublic('project', id); }
  createGig(userId: string, dto: CreateGigDto) { return this.marketplace.create('project', userId, dto); }
}

