import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class WeaponDetailEntryDto {
  @IsOptional() @IsString() group?: string;
  @IsString() key!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() minValue?: string;
  @IsOptional() @IsString() maxValue?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class CreateWeaponDto {
  @IsString() name!: string;
  @IsString() class!: string;
  @IsString() rarity!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() acquisition?: string;
  @IsOptional() @IsString() expertiseCategory?: string;
  @IsOptional() @IsString() itemLevel?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean() isNamed?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isExotic?: boolean;

  @IsOptional() @IsString() baseDamage?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) rpm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) magSize?: number;

  @IsOptional() @IsString() talentId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() wikiUrl?: string;
  @IsOptional() @IsString() targetLootRef?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() patchVersion?: string;
  @IsOptional() @IsString() sourceId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeaponDetailEntryDto)
  detailEntries?: WeaponDetailEntryDto[];
}

export class UpdateWeaponDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() class?: string;
  @IsOptional() @IsString() rarity?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() acquisition?: string;
  @IsOptional() @IsString() expertiseCategory?: string;
  @IsOptional() @IsString() itemLevel?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean() isNamed?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isExotic?: boolean;

  @IsOptional() @IsString() baseDamage?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) rpm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) magSize?: number;

  @IsOptional() @IsString() talentId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() wikiUrl?: string;
  @IsOptional() @IsString() targetLootRef?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsString() patchVersion?: string;
  @IsOptional() @IsString() sourceId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeaponDetailEntryDto)
  detailEntries?: WeaponDetailEntryDto[];
}
