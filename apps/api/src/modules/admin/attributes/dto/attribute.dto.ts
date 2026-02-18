import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const CATEGORIES = ["Offensive", "Defensive", "Utility"] as const;
const UNITS = ["PERCENT", "FLAT"] as const;

export class CreateAttributeDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(CATEGORIES) category!: string;
  @IsIn(UNITS) unit!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAttributeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsIn(UNITS) unit?: string;
  @IsOptional() @IsString() notes?: string;
}
