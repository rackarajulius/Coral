import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601,
  IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export class AddSlotsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(240)
  durationMins?: number;

  @IsOptional()
  @IsIn(['video', 'phone', 'onsite'])
  medium?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsISO8601({}, { each: true })
  slots!: string[];
}
