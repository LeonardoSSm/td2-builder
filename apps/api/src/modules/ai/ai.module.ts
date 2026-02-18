import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiGuard } from "./ai.guard";
import { AccessControlModule } from "../access-control/access-control.module";

@Module({
  imports: [ConfigModule, AccessControlModule],
  controllers: [AiController],
  providers: [AiService, AiGuard],
})
export class AiModule {}
