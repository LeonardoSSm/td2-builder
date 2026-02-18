import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { TargetLootService } from "./target-loot.service";
import { CreateTargetLootLogDto } from "./dto/target-loot.dto";

@Controller("target-loot")
export class TargetLootController {
  constructor(private readonly svc: TargetLootService) {}

  @Get()
  list(@Query("targetLootRef") targetLootRef?: string) {
    return this.svc.list(targetLootRef);
  }

  @Post()
  create(@Body() dto: CreateTargetLootLogDto) {
    return this.svc.create(dto);
  }
}
