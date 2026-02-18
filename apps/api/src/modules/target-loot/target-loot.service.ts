import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTargetLootLogDto } from "./dto/target-loot.dto";

@Injectable()
export class TargetLootService {
  constructor(private readonly prisma: PrismaService) {}

  list(targetLootRef?: string) {
    return this.prisma.targetLootLog.findMany({
      where: targetLootRef ? { targetLootRef } : undefined,
      orderBy: { date: "desc" },
      take: 200,
    });
  }

  create(dto: CreateTargetLootLogDto) {
    return this.prisma.targetLootLog.create({
      data: {
        date: new Date(dto.date),
        locationType: dto.locationType,
        locationName: dto.locationName,
        targetLootRef: dto.targetLootRef,
        targetLootName: dto.targetLootName,
        sourceUrl: dto.sourceUrl,
        notes: dto.notes,
      },
    });
  }
}
