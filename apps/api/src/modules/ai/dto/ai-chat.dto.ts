import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class AiChatMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MaxLength(8000)
  text!: string;
}

export class AiChatDto {
  @IsString()
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsString()
  lang?: string; // "pt-BR" | "en"

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  history?: AiChatMessageDto[];
}

