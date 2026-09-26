import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResharePostDto {
  /**
   * Your own words on top, if any.
   *
   * Optional because passing something on without comment is a real thing to
   * do — an employee amplifying their company's post usually has nothing to
   * add, and requiring a line would mean inventing one.
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}
