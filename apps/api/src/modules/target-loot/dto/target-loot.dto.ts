import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateTargetLootLogDto {
  @IsDateString() date!: string;
  @IsOptional() @IsString() locationType?: string;
  @IsOptional() @IsString() locationName?: string;
  @IsOptional() @IsString() targetLootRef?: string;
  @IsOptional() @IsString() targetLootName?: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() notes?: string;
}
