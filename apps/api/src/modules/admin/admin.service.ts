import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";
import { AttributeCategory, AttributeUnit, GearItemStatKind, Prisma, TalentType } from "@prisma/client";

function autoId(prefix: string): string {
  // Short, unique, readable enough for admin-created records.
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

type ExtendedDetails = {
  description?: string;
  acquisition?: string;
  expertiseCategory?: string;
  itemLevel?: string;
  detailEntries?: Array<{
    group?: string;
    key: string;
    value: string;
    unit?: string;
    minValue?: string;
    maxValue?: string;
    notes?: string;
    order?: number;
  }>;
};

type GearStatCreate = {
  kind: GearItemStatKind;
  name: string;
  value?: string | null;
  unit?: string | null;
  order?: number;
};

type GearModCreate = {
  name: string;
  value?: string | null;
  order?: number;
};

function parseExtendedDetails(notes?: string | null): ExtendedDetails | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._kind === "td2_extended_item_details") {
      return {
        description: parsed.description,
        acquisition: parsed.acquisition,
        expertiseCategory: parsed.expertiseCategory,
        itemLevel: parsed.itemLevel,
        detailEntries: Array.isArray(parsed.detailEntries) ? parsed.detailEntries : [],
      };
    }
  } catch {
    return null;
  }
  return null;
}

function buildNotes(existingNotes?: string | null, input?: any): string | undefined {
  const base = parseExtendedDetails(existingNotes) ?? {};
  const details: ExtendedDetails = {
    description: input?.description ?? base.description,
    acquisition: input?.acquisition ?? base.acquisition,
    expertiseCategory: input?.expertiseCategory ?? base.expertiseCategory,
    itemLevel: input?.itemLevel ?? base.itemLevel,
    detailEntries: input?.detailEntries ?? base.detailEntries ?? [],
  };

  const hasDetails =
    !!details.description ||
    !!details.acquisition ||
    !!details.expertiseCategory ||
    !!details.itemLevel ||
    (details.detailEntries?.length ?? 0) > 0;

  if (!hasDetails) return input?.notes ?? existingNotes ?? undefined;

  return JSON.stringify({
    _kind: "td2_extended_item_details",
    description: details.description,
    acquisition: details.acquisition,
    expertiseCategory: details.expertiseCategory,
    itemLevel: details.itemLevel,
    detailEntries: details.detailEntries ?? [],
  });
}

function extractGearStructured(input?: any): { stats?: GearStatCreate[]; mods?: GearModCreate[] } {
  const entries = Array.isArray(input?.detailEntries) ? input.detailEntries : [];
  if (!entries.length) return {};

  const by = (group: string, key: string) =>
    String(entries.find((e: any) => e?.group === group && e?.key === key)?.value ?? "").trim();

  const coreName = by("gear_core", "CoreAttribute");
  const coreValue = by("gear_core", "CoreValue");

  const a1n = by("gear_attrs", "Attr1Name");
  const a1v = by("gear_attrs", "Attr1Value");
  const a2n = by("gear_attrs", "Attr2Name");
  const a2v = by("gear_attrs", "Attr2Value");

  const m1n = by("gear_mods", "Mod1Name");
  const m1v = by("gear_mods", "Mod1Value");
  const m2n = by("gear_mods", "Mod2Name");
  const m2v = by("gear_mods", "Mod2Value");

  const stats: GearStatCreate[] = [];
  if (coreName) stats.push({ kind: GearItemStatKind.CORE, name: coreName, value: coreValue || null, order: 1 });
  if (a1n) stats.push({ kind: GearItemStatKind.MINOR, name: a1n, value: a1v || null, order: 10 });
  if (a2n) stats.push({ kind: GearItemStatKind.MINOR, name: a2n, value: a2v || null, order: 11 });

  const mods: GearModCreate[] = [];
  if (m1n) mods.push({ name: m1n, value: m1v || null, order: 1 });
  if (m2n) mods.push({ name: m2n, value: m2v || null, order: 2 });

  return {
    stats: stats.length ? stats : undefined,
    mods: mods.length ? mods : undefined,
  };
}

function toGearDbData(input: any, existingNotes?: string | null) {
  const {
    description,
    acquisition,
    expertiseCategory,
    itemLevel,
    detailEntries,
    ...rest
  } = input ?? {};

  return {
    ...rest,
    notes: buildNotes(existingNotes, {
      ...rest,
      description,
      acquisition,
      expertiseCategory,
      itemLevel,
      detailEntries,
    }),
  };
}

function toWeaponDbData(input: any, existingNotes?: string | null) {
  const {
    description,
    acquisition,
    expertiseCategory,
    itemLevel,
    detailEntries,
    ...rest
  } = input ?? {};

  return {
    ...rest,
    notes: buildNotes(existingNotes, {
      ...rest,
      description,
      acquisition,
      expertiseCategory,
      itemLevel,
      detailEntries,
    }),
  };
}

function normalizeGearData(input: any, existing?: any) {
  const effective = {
    ...(existing ?? {}),
    ...(input ?? {}),
  };
  const normalized = { ...(input ?? {}) };

  if (effective.rarity === "GearSet") {
    if (!effective.setId) {
      throw new BadRequestException("setId is required when rarity is GearSet.");
    }
    if (effective.brandId) {
      throw new BadRequestException("brandId must be empty when rarity is GearSet.");
    }
  }

  if (effective.coreColor && (effective.coreCount === undefined || effective.coreCount === null)) {
    if (normalized.coreCount === undefined && normalized.coreColor !== undefined) {
      normalized.coreCount = 1;
    }
  }

  return normalized;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createGearSetIfMissingByName(nameRaw: string) {
    return this.createGearSet({ name: String(nameRaw ?? "") });
  }

  listGearSetsAdmin() {
    return this.prisma.gearSet.findMany({ orderBy: { name: "asc" } });
  }

  async updateGearSetName(id: string, nameRaw: string) {
    return this.updateGearSet(id, { name: String(nameRaw ?? "") });
  }

  async createGearSet(dto: any) {
    const name = String(dto?.name ?? "").trim();
    if (!name) throw new BadRequestException("name is required");

    const existing = await this.prisma.gearSet.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return existing;

    const id = autoId("SET_");
    try {
      return await this.prisma.gearSet.create({
        data: {
          id,
          name,
          description: dto?.description ?? null,
          bonus2: dto?.bonus2 ?? null,
          bonus3: dto?.bonus3 ?? null,
          bonus4: dto?.bonus4 ?? null,
          wikiUrl: dto?.wikiUrl ?? null,
          logoUrl: dto?.logoUrl ?? null,
        },
      });
    } catch (e: any) {
      // If another request created it in parallel, the DB-level unique index will throw.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const after = await this.prisma.gearSet.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (after) return after;
      }
      throw e;
    }
  }

  async updateGearSet(id: string, dto: any) {
    const exists = await this.prisma.gearSet.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("GearSet not found");
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name ?? "").trim();
    if (dto?.description !== undefined) data.description = dto.description || null;
    if (dto?.bonus2 !== undefined) data.bonus2 = dto.bonus2 || null;
    if (dto?.bonus3 !== undefined) data.bonus3 = dto.bonus3 || null;
    if (dto?.bonus4 !== undefined) data.bonus4 = dto.bonus4 || null;
    if (dto?.wikiUrl !== undefined) data.wikiUrl = dto.wikiUrl || null;
    if (dto?.logoUrl !== undefined) data.logoUrl = dto.logoUrl || null;
    if (!Object.keys(data).length) return exists;
    return this.prisma.gearSet.update({ where: { id }, data });
  }

  async deleteGearSet(id: string) {
    const exists = await this.prisma.gearSet.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("GearSet not found");
    return this.prisma.gearSet.delete({ where: { id } });
  }

  listBrandsAdmin() {
    return this.prisma.brand.findMany({ orderBy: { name: "asc" } });
  }

  createBrand(dto: any) {
    const id = autoId("BRD_");
    return this.prisma.brand.create({
      data: {
        id,
        name: String(dto?.name ?? "").trim(),
        bonus1: dto?.bonus1 ?? null,
        bonus2: dto?.bonus2 ?? null,
        bonus3: dto?.bonus3 ?? null,
        wikiUrl: dto?.wikiUrl ?? null,
        logoUrl: dto?.logoUrl ?? null,
      },
    });
  }

  async updateBrand(id: string, dto: any) {
    const exists = await this.prisma.brand.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Brand not found");
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name).trim();
    if (dto?.bonus1 !== undefined) data.bonus1 = dto.bonus1 || null;
    if (dto?.bonus2 !== undefined) data.bonus2 = dto.bonus2 || null;
    if (dto?.bonus3 !== undefined) data.bonus3 = dto.bonus3 || null;
    if (dto?.wikiUrl !== undefined) data.wikiUrl = dto.wikiUrl || null;
    if (dto?.logoUrl !== undefined) data.logoUrl = dto.logoUrl || null;
    return this.prisma.brand.update({ where: { id }, data });
  }

  async deleteBrand(id: string) {
    const exists = await this.prisma.brand.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Brand not found");
    return this.prisma.brand.delete({ where: { id } });
  }

  listTalentsAdmin() {
    return this.prisma.talent.findMany({ orderBy: { name: "asc" } });
  }

  createTalent(dto: any) {
    const id = autoId("TLT_");
    const type = (dto?.type ?? TalentType.Weapon) as TalentType;
    return this.prisma.talent.create({
      data: {
        id,
        name: String(dto?.name ?? "").trim(),
        type,
        description: dto?.description ?? null,
        wikiUrl: dto?.wikiUrl ?? null,
      },
    });
  }

  async updateTalent(id: string, dto: any) {
    const exists = await this.prisma.talent.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Talent not found");
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name).trim();
    if (dto?.type !== undefined) data.type = dto.type as TalentType;
    if (dto?.description !== undefined) data.description = dto.description || null;
    if (dto?.wikiUrl !== undefined) data.wikiUrl = dto.wikiUrl || null;
    return this.prisma.talent.update({ where: { id }, data });
  }

  async deleteTalent(id: string) {
    const exists = await this.prisma.talent.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Talent not found");
    return this.prisma.talent.delete({ where: { id } });
  }

  listAttributesAdmin() {
    return this.prisma.attribute.findMany({ orderBy: { name: "asc" } });
  }

  createAttribute(dto: any) {
    const id = autoId("ATR_");
    const category = (dto?.category ?? AttributeCategory.Offensive) as AttributeCategory;
    const unit = (dto?.unit ?? AttributeUnit.PERCENT) as AttributeUnit;
    return this.prisma.attribute.create({
      data: {
        id,
        name: String(dto?.name ?? "").trim(),
        category,
        unit,
        notes: dto?.notes ?? null,
      },
    });
  }

  async updateAttribute(id: string, dto: any) {
    const exists = await this.prisma.attribute.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Attribute not found");
    const data: any = {};
    if (dto?.name !== undefined) data.name = String(dto.name).trim();
    if (dto?.category !== undefined) data.category = dto.category as AttributeCategory;
    if (dto?.unit !== undefined) data.unit = dto.unit as AttributeUnit;
    if (dto?.notes !== undefined) data.notes = dto.notes || null;
    return this.prisma.attribute.update({ where: { id }, data });
  }

  async deleteAttribute(id: string) {
    const exists = await this.prisma.attribute.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Attribute not found");
    return this.prisma.attribute.delete({ where: { id } });
  }

  // Gear Items
  createGearItem(data: any) {
    const id = autoId("ITG_");
    const normalized = normalizeGearData(data);
    const structured = extractGearStructured(normalized);
    return this.prisma.gearItem.create({
      data: {
        ...toGearDbData({ ...normalized, id }),
        stats: structured.stats?.length ? { create: structured.stats } : undefined,
        mods: structured.mods?.length ? { create: structured.mods } : undefined,
      },
    });
  }

  async updateGearItem(id: string, data: any) {
    const exists = await this.prisma.gearItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Gear item not found");
    const normalized = normalizeGearData(data, exists);
    const structured = extractGearStructured(normalized);
    const hasStructuredUpdate = Array.isArray((normalized as any)?.detailEntries);

    if (!hasStructuredUpdate) {
      return this.prisma.gearItem.update({
        where: { id },
        data: toGearDbData(normalized, exists.notes),
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.gearItemStat.deleteMany({ where: { itemId: id } });
      await tx.gearItemMod.deleteMany({ where: { itemId: id } });
      return tx.gearItem.update({
        where: { id },
        data: {
          ...toGearDbData(normalized, exists.notes),
          stats: structured.stats?.length ? { create: structured.stats } : undefined,
          mods: structured.mods?.length ? { create: structured.mods } : undefined,
        },
      });
    });

    return updated;
  }

  deleteGearItem(id: string) {
    return this.prisma.gearItem.delete({ where: { id } });
  }

  // Weapons
  createWeapon(data: any) {
    const id = autoId("WPN_");
    return this.prisma.weapon.create({ data: toWeaponDbData({ ...(data ?? {}), id }) });
  }

  async updateWeapon(id: string, data: any) {
    const exists = await this.prisma.weapon.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Weapon not found");
    return this.prisma.weapon.update({
      where: { id },
      data: toWeaponDbData(data, exists.notes),
    });
  }

  deleteWeapon(id: string) {
    return this.prisma.weapon.delete({ where: { id } });
  }
}
