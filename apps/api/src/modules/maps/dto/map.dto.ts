import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class CreateFarmMapDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]{2,48}$/)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  centerX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  centerY?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(4)
  zoom?: number;
}

export class UpdateFarmMapDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  @Matches(/^[a-z0-9-]{2,48}$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  centerX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  centerY?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(4)
  zoom?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}
