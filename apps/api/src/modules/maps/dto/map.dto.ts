import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class CreateFarmMapDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]{2,48}$/)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
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
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
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
  imageUrl?: string | null;
}
