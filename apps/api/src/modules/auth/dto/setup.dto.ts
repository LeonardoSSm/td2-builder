import { IsString, MinLength } from "class-validator";

// One-time setup endpoint. Only works when no user has a password set yet.
export class SetupDto {
  @IsString() @MinLength(6) password!: string;
}
