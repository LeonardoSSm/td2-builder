import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { AttributeCategory, AttributeUnit } from "@prisma/client";

const CATEGORIES = ["Offensive", "Defensive", "Utility"] as const;
const UNITS = ["PERCENT", "FLAT"] as const;

export class CreateAttributeDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(CATEGORIES) category!: AttributeCategory;
  @IsIn(UNITS) unit!: AttributeUnit;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAttributeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: AttributeCategory;
  @IsOptional() @IsIn(UNITS) unit?: AttributeUnit;
  @IsOptional() @IsString() notes?: string;
}
