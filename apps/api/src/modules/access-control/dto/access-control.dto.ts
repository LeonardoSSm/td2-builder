import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { PERMISSIONS } from "../access-control.types";

export class UpsertAccessProfileDto {
  @IsString() name!: string;
  @IsArray()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: string[];
}

export class UpsertAccessUserDto {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() profileId!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateAccessProfileDto extends UpsertAccessProfileDto {}
export class UpdateAccessUserDto extends UpsertAccessUserDto {}
