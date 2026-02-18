import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogGearQueryDto, CatalogWeaponQueryDto } from "./dto/catalog-query.dto";

function parseDetailModel(notes?: string | null) {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._kind === "td2_extended_item_details") {
      return {
        description: parsed.description ?? null,
        acquisition: parsed.acquisition ?? null,
        expertiseCategory: parsed.expertiseCategory ?? null,
        itemLevel: parsed.itemLevel ?? null,
        detailEntries: Array.isArray(parsed.detailEntries) ? parsed.detailEntries : [],
      };
    }
  } catch {
    return null;
  }
  return null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listBrands() {
    return this.prisma.brand.findMany({ orderBy: { name: "asc" } });
  }

  listGearSets() {
    return this.prisma.gearSet.findMany({ orderBy: { name: "asc" } });
  }

  listTalents(type?: string, q?: string, take?: number) {
    const qq = String(q ?? "").trim();
    const where: any = {};
    if (type) where.type = type;
    if (qq) {
      where.OR = [
        { name: { contains: qq, mode: "insensitive" } },
        { id: { contains: qq, mode: "insensitive" } },
      ];
    }
    return this.prisma.talent.findMany({
      where: Object.keys(where).length ? where : undefined,
      take: take ?? (qq ? 50 : 200),
      orderBy: { name: "asc" },
    });
  }

  async listGearItems(q: CatalogGearQueryDto) {
    const where: any = {};
    if (q.slot) where.slot = q.slot;
    if (q.rarity) where.rarity = q.rarity;
    if (q.brandId) where.brandId = q.brandId;
    if (q.setId) where.setId = q.setId;
    if (q.q) where.name = { contains: q.q, mode: "insensitive" };

    const [items, total] = await Promise.all([
      this.prisma.gearItem.findMany({
        where,
        include: q.includeDetails
          ? { brand: true, gearSet: true, talent: true, stats: true, mods: true }
          : { brand: true, gearSet: true, talent: true },
        orderBy: { name: "asc" },
        skip: q.skip ?? 0,
        take: q.take ?? 50,
      }),
      this.prisma.gearItem.count({ where }),
    ]);

    if (!q.includeDetails) return { total, items };
    return {
      total,
      items: items.map((x: any) => ({ ...x, detailModel: parseDetailModel(x.notes) })),
    };
  }

  async listWeapons(q: CatalogWeaponQueryDto) {
    const where: any = {};
    if (q.class) where.class = q.class;
    if (q.rarity) where.rarity = q.rarity;
    if (q.q) where.name = { contains: q.q, mode: "insensitive" };

    const [items, total] = await Promise.all([
      this.prisma.weapon.findMany({
        where,
        include: { talent: true },
        orderBy: { name: "asc" },
        skip: q.skip ?? 0,
        take: q.take ?? 50,
      }),
      this.prisma.weapon.count({ where }),
    ]);

    if (!q.includeDetails) return { total, items };
    return {
      total,
      items: items.map((x: any) => ({ ...x, detailModel: parseDetailModel(x.notes) })),
    };
  }

  async getGearItem(id: string) {
    const item = await this.prisma.gearItem.findUnique({
      where: { id },
      include: {
        brand: true,
        gearSet: true,
        talent: true,
        rules: { include: { attribute: true } },
        stats: { orderBy: { order: "asc" } },
        mods: { orderBy: { order: "asc" } },
      },
    });
    if (!item) return null;
    return { ...item, detailModel: parseDetailModel(item.notes) };
  }

  async getWeapon(id: string) {
    const item = await this.prisma.weapon.findUnique({
      where: { id },
      include: { talent: true },
    });
    if (!item) return null;
    return { ...item, detailModel: parseDetailModel(item.notes) };
  }
}
