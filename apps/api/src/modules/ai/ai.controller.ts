import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiChatDto } from "./dto/ai-chat.dto";
import { AiGuard } from "./ai.guard";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("chat")
  @UseGuards(AiGuard)
  async chat(@Body() dto: AiChatDto) {
    const text = await this.ai.chat(dto.message, dto.history, dto.lang);
    return { text };
  }
}

