import { Controller, Get, Header, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CitiesService } from './cities.service';
import { CitySearchDto } from './dto/city-search.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly cities: CitiesService) {}

  /**
   * City suggestions for location fields. Public: it is a gazetteer, and the
   * same box will appear before sign-in. Answers can be cached by the
   * browser for a day — the list changes when it is rebuilt, not by the hour.
   */
  @Public()
  @Get('cities')
  @Header('Cache-Control', 'public, max-age=86400')
  search(@Query() dto: CitySearchDto) {
    const near = this.cities.countryCodeOf(dto.near);
    return { success: true, data: this.cities.search(dto.q, { near, limit: dto.limit }) };
  }
}
