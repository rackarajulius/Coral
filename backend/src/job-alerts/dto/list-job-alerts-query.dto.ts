import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListJobAlertsQueryDto extends PaginationDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
