import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateFarmAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  itemType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  itemRef?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(600)
  radiusPx?: number;

  @IsOptional()
  @IsIn(["red", "orange", "yellow", "green", "blue", "purple", "white"])
  color?: string;
}

export class UpdateFarmAreaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  itemType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  itemRef?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  x?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  y?: number;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(600)
  radiusPx?: number;

  @IsOptional()
  @IsIn(["red", "orange", "yellow", "green", "blue", "purple", "white"])
  color?: string;
}
