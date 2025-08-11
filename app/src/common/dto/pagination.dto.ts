import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  get skip(): number {
    // If offset is provided, use it directly; otherwise calculate from page
    if (this.offset !== undefined) {
      return this.offset;
    }
    return ((this.page ?? 1) - 1) * (this.limit ?? 10);
  }
}