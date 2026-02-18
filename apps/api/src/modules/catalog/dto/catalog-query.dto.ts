import { IsBoolean, IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

const GEAR_SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;
const GEAR_RARITIES = ["HighEnd", "Named", "Exotic", "GearSet"] as const;
const WEAPON_CLASSES = ["AR", "SMG", "LMG", "Rifle", "MMR", "Shotgun", "Pistol"] as const;
const WEAPON_RARITIES = ["HighEnd", "Named", "Exotic"] as const;
const TALENT_TYPES = ["Weapon", "Chest", "Backpack", "GearSet"] as const;

export class CatalogGearQueryDto {
  @IsOptional() @IsString() @IsIn(GEAR_SLOTS as any) slot?: string;
  @IsOptional() @IsString() @IsIn(GEAR_RARITIES as any) rarity?: string;
  @IsOptional() @IsString() @MaxLength(64) brandId?: string;
  @IsOptional() @IsString() @MaxLength(64) setId?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeDetails?: boolean = false;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number = 50;
}

export class CatalogWeaponQueryDto {
  @IsOptional() @IsString() @IsIn(WEAPON_CLASSES as any) class?: string;
  @IsOptional() @IsString() @IsIn(WEAPON_RARITIES as any) rarity?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeDetails?: boolean = false;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number = 50;
}

export class CatalogTalentQueryDto {
  @IsOptional() @IsString() @IsIn(TALENT_TYPES as any) type?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number;
}
