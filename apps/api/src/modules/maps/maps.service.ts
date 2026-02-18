import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

function autoId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowDbNotReady(e: any): never {
    // When migrations aren't applied yet Prisma throws "table does not exist" (often P2021).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      throw new ServiceUnavailableException("Maps tables are missing. Run: cd apps/api && npx prisma migrate dev");
    }
    const msg = String(e?.message ?? "");
    if (msg.includes("does not exist") && msg.includes("FarmMap")) {
      throw new ServiceUnavailableException("Maps tables are missing. Run: cd apps/api && npx prisma migrate dev");
    }
    throw e;
  }

  listMaps() {
    return this.prisma.farmMap.findMany({ orderBy: { name: "asc" } }).catch((e) => this.rethrowDbNotReady(e));
  }

  async getMapBySlug(slugRaw: string) {
    const slug = String(slugRaw ?? "").trim();
    if (!slug) throw new BadRequestException("slug is required");
    const map = await this.prisma.farmMap.findUnique({ where: { slug } }).catch((e) => this.rethrowDbNotReady(e));
    if (!map) throw new NotFoundException("Map not found");
    return map;
  }

  async listAreasBySlug(slug: string) {
    const map = await this.getMapBySlug(slug);
    const areas = await this.prisma.farmArea
      .findMany({
        where: { mapId: map.id },
        orderBy: [{ title: "asc" }, { createdAt: "desc" }],
      })
      .catch((e) => this.rethrowDbNotReady(e));
    return { map, areas };
  }

  async createMap(dto: any) {
    const slug = String(dto?.slug ?? "").trim().toLowerCase();
    const name = String(dto?.name ?? "").trim();
    if (!slug) throw new BadRequestException("slug is required");
    if (!name) throw new BadRequestException("name is required");
    const id = autoId("MAP_");
    return this.prisma.farmMap.create({
      data: {
        id,
        slug,
        name,
        imageUrl: dto?.imageUrl ?? null,
        centerX: dto?.centerX ?? 0.5,
        centerY: dto?.centerY ?? 0.5,
        zoom: dto?.zoom ?? 1,
      },
    }).catch((e) => this.rethrowDbNotReady(e));
  }

  async updateMap(id: string, dto: any) {
    const exists = await this.prisma.farmMap.findUnique({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
    if (!exists) throw new NotFoundException("Map not found");
    const data: any = {};
    if (dto?.slug !== undefined) data.slug = String(dto.slug ?? "").trim().toLowerCase();
    if (dto?.name !== undefined) data.name = String(dto.name ?? "").trim();
    if (dto?.centerX !== undefined) data.centerX = Number(dto.centerX);
    if (dto?.centerY !== undefined) data.centerY = Number(dto.centerY);
    if (dto?.zoom !== undefined) data.zoom = dto.zoom;
    if (dto?.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    return this.prisma.farmMap.update({ where: { id }, data }).catch((e) => this.rethrowDbNotReady(e));
  }

  async setMapImage(id: string, filename: string) {
    const exists = await this.prisma.farmMap.findUnique({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
    if (!exists) throw new NotFoundException("Map not found");
    const imageUrl = `/maps/assets/${filename}`;
    return this.prisma.farmMap.update({ where: { id }, data: { imageUrl } }).catch((e) => this.rethrowDbNotReady(e));
  }

  async deleteMap(id: string) {
    const exists = await this.prisma.farmMap.findUnique({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
    if (!exists) throw new NotFoundException("Map not found");
    return this.prisma.farmMap.delete({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
  }

  async createArea(mapId: string, dto: any) {
    const map = await this.prisma.farmMap.findUnique({ where: { id: mapId } }).catch((e) => this.rethrowDbNotReady(e));
    if (!map) throw new NotFoundException("Map not found");
    const title = String(dto?.title ?? "").trim();
    if (!title) throw new BadRequestException("title is required");
    const id = autoId("AREA_");
    return this.prisma.farmArea.create({
      data: {
        id,
        mapId,
        title,
        description: dto?.description ?? null,
        itemType: dto?.itemType ?? null,
        itemRef: dto?.itemRef ?? null,
        x: Number(dto?.x),
        y: Number(dto?.y),
        radiusPx: dto?.radiusPx ?? 60,
        color: String(dto?.color ?? "red"),
      },
    }).catch((e) => this.rethrowDbNotReady(e));
  }

  async updateArea(id: string, dto: any) {
    const exists = await this.prisma.farmArea.findUnique({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
    if (!exists) throw new NotFoundException("Area not found");
    const data: any = {};
    if (dto?.title !== undefined) data.title = String(dto.title ?? "").trim();
    if (dto?.description !== undefined) data.description = dto.description;
    if (dto?.itemType !== undefined) data.itemType = dto.itemType;
    if (dto?.itemRef !== undefined) data.itemRef = dto.itemRef;
    if (dto?.x !== undefined) data.x = Number(dto.x);
    if (dto?.y !== undefined) data.y = Number(dto.y);
    if (dto?.radiusPx !== undefined) data.radiusPx = dto.radiusPx;
    if (dto?.color !== undefined) data.color = String(dto.color ?? "red");
    return this.prisma.farmArea.update({ where: { id }, data }).catch((e) => this.rethrowDbNotReady(e));
  }

  async deleteArea(id: string) {
    const exists = await this.prisma.farmArea.findUnique({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
    if (!exists) throw new NotFoundException("Area not found");
    return this.prisma.farmArea.delete({ where: { id } }).catch((e) => this.rethrowDbNotReady(e));
  }
}
