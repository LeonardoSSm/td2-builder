import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateFarmAreaDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  color?: string;
}

export class UpdateFarmAreaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  itemType?: string | null;

  @IsOptional()
  @IsString()
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
  @IsString()
  color?: string;
}
