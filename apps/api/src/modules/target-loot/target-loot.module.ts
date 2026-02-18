import { Module } from "@nestjs/common";
import { TargetLootController } from "./target-loot.controller";
import { TargetLootService } from "./target-loot.service";

@Module({
  controllers: [TargetLootController],
  providers: [TargetLootService],
})
export class TargetLootModule {}
