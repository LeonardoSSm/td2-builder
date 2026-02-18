import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const TALENT_TYPES = ["Weapon", "Chest", "Backpack", "GearSet"] as const;

export class CreateTalentDto {
  @IsString() @MinLength(2) name!: string;
  @IsIn(TALENT_TYPES) type!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() wikiUrl?: string;
}

export class UpdateTalentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(TALENT_TYPES) type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() wikiUrl?: string;
}
