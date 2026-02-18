import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateGearSetDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() bonus2?: string;
  @IsOptional() @IsString() bonus3?: string;
  @IsOptional() @IsString() bonus4?: string;
  @IsOptional() @IsString() wikiUrl?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

export class UpdateGearSetDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() bonus2?: string | null;
  @IsOptional() @IsString() bonus3?: string | null;
  @IsOptional() @IsString() bonus4?: string | null;
  @IsOptional() @IsString() wikiUrl?: string | null;
  @IsOptional() @IsString() logoUrl?: string | null;
}
