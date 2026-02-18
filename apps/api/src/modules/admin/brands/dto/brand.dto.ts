import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateBrandDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() bonus1?: string;
  @IsOptional() @IsString() bonus2?: string;
  @IsOptional() @IsString() bonus3?: string;
  @IsOptional() @IsString() wikiUrl?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

export class UpdateBrandDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() bonus1?: string;
  @IsOptional() @IsString() bonus2?: string;
  @IsOptional() @IsString() bonus3?: string;
  @IsOptional() @IsString() wikiUrl?: string;
  @IsOptional() @IsString() logoUrl?: string;
}
