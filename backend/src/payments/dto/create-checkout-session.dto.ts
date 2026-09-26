import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsInt()
  @Min(50)
  unitAmount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number = 1;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string = 'usd';

  @IsString()
  @MaxLength(150)
  productName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUrl({ require_tld: false })
  successUrl: string;

  @IsUrl({ require_tld: false })
  cancelUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}
