import { IsString, MaxLength, MinLength } from "class-validator";

export class SetPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(200)
  password!: string;
}
