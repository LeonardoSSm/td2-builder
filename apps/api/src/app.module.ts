import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { AdminModule } from "./modules/admin/admin.module";
import { ImportsModule } from "./modules/imports/imports.module";
import { BuildsModule } from "./modules/builds/builds.module";
import { TargetLootModule } from "./modules/target-loot/target-loot.module";
import { AccessControlModule } from "./modules/access-control/access-control.module";
import { AuthModule } from "./modules/auth/auth.module";
import { MapsModule } from "./modules/maps/maps.module";
import { AiModule } from "./modules/ai/ai.module";
import { AuditModule } from "./modules/audit/audit.module";
import { MonitorModule } from "./modules/monitor/monitor.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    CatalogModule,
    AdminModule,
    ImportsModule,
    BuildsModule,
    TargetLootModule,
    AccessControlModule,
    AuthModule,
    MapsModule,
    AiModule,
    AuditModule,
    MonitorModule,
  ],
})
export class AppModule {}
