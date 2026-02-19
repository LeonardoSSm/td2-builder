import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { CoreColor, GearRarity, GearSlot } from "@prisma/client";

const SLOT_OPTIONS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;
const RARITY_OPTIONS = ["HighEnd", "Named", "Exotic", "GearSet"] as const;
const CORE_COLOR_OPTIONS = ["Red", "Blue", "Yellow"] as const;

export class GearItemDetailEntryDto {
  @IsOptional() @IsString() group?: string;
  @IsString() key!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() minValue?: string;
  @IsOptional() @IsString() maxValue?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class CreateGearItemDto {
  @IsString() name!: string;
  @IsIn(SLOT_OPTIONS) slot!: GearSlot;
  @IsIn(RARITY_OPTIONS) rarity!: GearRarity;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() acquisition?: string;
  @IsOptional() @IsString() expertiseCategory?: string;
  @IsOptional() @IsString() itemLevel?: string;

  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() setId?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean() isNamed?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isExotic?: boolean;

  @IsOptional() @IsIn(CORE_COLOR_OPTIONS) coreColor?: CoreColor;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) coreCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) modSlots?: number;

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
  @Type(() => GearItemDetailEntryDto)
  detailEntries?: GearItemDetailEntryDto[];
}

export class UpdateGearItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(SLOT_OPTIONS) slot?: GearSlot;
  @IsOptional() @IsIn(RARITY_OPTIONS) rarity?: GearRarity;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() acquisition?: string;
  @IsOptional() @IsString() expertiseCategory?: string;
  @IsOptional() @IsString() itemLevel?: string;

  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() setId?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean() isNamed?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isExotic?: boolean;

  @IsOptional() @IsIn(CORE_COLOR_OPTIONS) coreColor?: CoreColor;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) coreCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) modSlots?: number;

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
  @Type(() => GearItemDetailEntryDto)
  detailEntries?: GearItemDetailEntryDto[];
}
