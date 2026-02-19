import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PERMISSIONS } from "../access-control.types";

export class UpsertAccessProfileDto {
  @IsString()
  @MaxLength(80)
  name!: string;
  @IsArray()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: string[];
}

export class UpsertAccessUserDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsString()
  @MaxLength(80)
  profileId!: string;

  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAccessProfileDto extends UpsertAccessProfileDto {}
export class UpdateAccessUserDto extends UpsertAccessUserDto {}
