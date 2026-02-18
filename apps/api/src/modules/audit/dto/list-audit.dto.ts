import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAuditDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsString()
  userId?: string;

  @IsOptional() @IsString()
  path?: string;

  @IsOptional() @IsIn(["true", "false"])
  ok?: "true" | "false";

  @IsOptional() @Type(() => Number) @IsInt() @Min(100) @Max(599)
  statusFrom?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(100) @Max(599)
  statusTo?: number;

  @IsOptional() @IsString()
  from?: string; // ISO

  @IsOptional() @IsString()
  to?: string; // ISO

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  take?: number = 20;
}

