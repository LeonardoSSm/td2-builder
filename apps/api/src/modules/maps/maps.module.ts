import { Module } from "@nestjs/common";
import { MapsController } from "./maps.controller";
import { AdminMapsController } from "./admin-maps.controller";
import { MapsService } from "./maps.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AccessControlModule } from "../access-control/access-control.module";

@Module({
  imports: [PrismaModule, AuthModule, AccessControlModule],
  controllers: [MapsController, AdminMapsController],
  providers: [MapsService],
})
export class MapsModule {}

