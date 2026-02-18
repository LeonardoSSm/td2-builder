import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type { CoreColor, GearSlot, RecommendedFocus } from "@prisma/client";

const BUILD_SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;

export class BuildSlotDto {
  @IsIn(BUILD_SLOTS) slot!: GearSlot;
  @IsOptional() @IsString() itemId?: string;
}

export class CreateBuildDto {
  @IsString() name!: string;
  @IsOptional() @IsString() patchVersion?: string;
}

export class UpdateBuildDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() patchVersion?: string;
  @IsOptional() @IsString() primaryWeaponId?: string;
  @IsOptional() @IsString() secondaryWeaponId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BuildSlotDto)
  slots?: BuildSlotDto[];
}

export class ApplyRecommendedBuildDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() patchVersion?: string;
}

const RECOMMENDED_FOCUS_OPTIONS = ["DPS", "Tank", "Skill"] as const;
const CORE_COLOR_OPTIONS = ["Red", "Blue", "Yellow"] as const;

export class UpsertRecommendedBuildProfileDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(RECOMMENDED_FOCUS_OPTIONS) focus!: RecommendedFocus;
  @IsIn(CORE_COLOR_OPTIONS) preferredCore!: CoreColor;
  @IsOptional() @IsArray() @IsString({ each: true }) setHints?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) brandHints?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) primaryWeaponHints?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) secondaryWeaponHints?: string[];
  @IsOptional() @IsObject() slotOverrides?: Record<string, string>;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateRecommendedBuildProfileDto extends UpsertRecommendedBuildProfileDto {}
