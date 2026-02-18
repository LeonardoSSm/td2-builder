import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApplyRecommendedBuildDto, CreateBuildDto, UpdateBuildDto, UpsertRecommendedBuildProfileDto } from "./dto/build.dto";
import { randomUUID } from "crypto";

const DEFAULT_SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;

type RecommendedBuildProfile = {
  id: string;
  name: string;
  description: string;
  focus: "DPS" | "Tank" | "Skill";
  preferredCore: "Red" | "Blue" | "Yellow";
  setHints: string[];
  brandHints: string[];
  primaryWeaponHints: string[];
  secondaryWeaponHints: string[];
  slotOverrides?: Partial<Record<(typeof DEFAULT_SLOTS)[number], string>>;
  enabled?: boolean;
};

type RecommendedBuildResult = {
  id: string;
  name: string;
  description: string;
  focus: "DPS" | "Tank" | "Skill";
  preferredCore: "Red" | "Blue" | "Yellow";
  slots: Array<{ slot: string; itemId: string | null; itemName: string | null }>;
  primaryWeaponId: string | null;
  primaryWeaponName: string | null;
  secondaryWeaponId: string | null;
  secondaryWeaponName: string | null;
  filledSlots: number;
  totalSlots: number;
};

const DEFAULT_RECOMMENDED_PROFILES: RecommendedBuildProfile[] = [
  {
    id: "striker_dps",
    name: "Striker DPS",
    description: "Foco em dano sustentado para PvE.",
    focus: "DPS",
    preferredCore: "Red",
    setHints: ["striker"],
    brandHints: ["grupo sombra", "ceska", "fenris", "providence"],
    primaryWeaponHints: ["AR", "LMG"],
    secondaryWeaponHints: ["SMG", "Shotgun"],
  },
  {
    id: "armor_regen_tank",
    name: "Armor Regen Tank",
    description: "Alta sobrevivencia com foco em armadura e regen.",
    focus: "Tank",
    preferredCore: "Blue",
    setHints: ["foundry", "future initiative"],
    brandHints: ["belstone", "gila", "badger"],
    primaryWeaponHints: ["Shotgun", "LMG"],
    secondaryWeaponHints: ["SMG", "Pistol"],
  },
  {
    id: "skill_damage",
    name: "Skill Damage",
    description: "Foco em dano de habilidade e uptime de skill.",
    focus: "Skill",
    preferredCore: "Yellow",
    setHints: ["rigger", "future initiative", "hard wired"],
    brandHints: ["hana", "wyvern", "empress"],
    primaryWeaponHints: ["AR", "Rifle"],
    secondaryWeaponHints: ["SMG", "Pistol"],
  },
];

function norm(v?: string | null): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyId(v: string): string {
  const base = (v ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
  return (base ? base : "rec") + "_" + suffix;
}

@Injectable()
export class BuildsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeUserId(userIdRaw: string): string {
    const userId = String(userIdRaw ?? "").trim();
    if (!userId) throw new UnauthorizedException("Missing user identity");
    return userId;
  }

  private async assertOwnershipOrThrow(buildId: string, userIdRaw: string) {
    const userId = this.normalizeUserId(userIdRaw);
    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      select: { id: true, ownerUserId: true },
    });
    if (!build) throw new NotFoundException("Build not found");
    if (!build.ownerUserId || build.ownerUserId !== userId) {
      // Hide existence from other users.
      throw new NotFoundException("Build not found");
    }
    return build;
  }

  async create(dto: CreateBuildDto, ownerUserIdRaw: string) {
    const ownerUserId = this.normalizeUserId(ownerUserIdRaw);
    const build = await this.prisma.build.create({
      data: {
        name: dto.name,
        patchVersion: dto.patchVersion,
        ownerUserId,
        slots: { create: DEFAULT_SLOTS.map(slot => ({ slot })) },
      },
      include: { slots: true },
    });
    return build;
  }

  async listMine(userIdRaw: string) {
    const userId = this.normalizeUserId(userIdRaw);
    return this.prisma.build.findMany({
      where: { ownerUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }

  async get(id: string, userIdRaw: string) {
    await this.assertOwnershipOrThrow(id, userIdRaw);
    const build = await this.prisma.build.findUnique({
      where: { id },
      include: {
        slots: { include: { item: { include: { brand: true, gearSet: true, talent: true } } } },
      },
    });
    if (!build) throw new NotFoundException("Build not found");
    return build;
  }

  async update(id: string, dto: UpdateBuildDto, userIdRaw: string) {
    await this.assertOwnershipOrThrow(id, userIdRaw);
    const exists = await this.prisma.build.findUnique({ where: { id }, include: { slots: true } });
    if (!exists) throw new NotFoundException("Build not found");

    // Update build header
    await this.prisma.build.update({
      where: { id },
      data: {
        name: dto.name,
        patchVersion: dto.patchVersion,
        primaryWeaponId: dto.primaryWeaponId,
        secondaryWeaponId: dto.secondaryWeaponId,
      },
    });

    // Update slots
    if (dto.slots?.length) {
      const ops = dto.slots.map((s) =>
        this.prisma.buildSlot.update({
          where: { buildId_slot: { buildId: id, slot: s.slot } },
          data: { itemId: s.itemId ?? null },
        }),
      );
      await this.prisma.$transaction(ops);
    }
    return this.get(id, userIdRaw);
  }

  async listRecommended() {
    return this.buildRecommendedBuilds();
  }

  async listRecommendedProfilesAdmin() {
    return this.prisma.recommendedBuildProfile.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] });
  }

  async createRecommendedProfileAdmin(dto: UpsertRecommendedBuildProfileDto) {
    const baseId = slugifyId(dto.name);
    const normalized: RecommendedBuildProfile = {
      id: baseId,
      name: dto.name.trim(),
      description: (dto.description ?? "").trim(),
      focus: dto.focus as "DPS" | "Tank" | "Skill",
      preferredCore: dto.preferredCore as "Red" | "Blue" | "Yellow",
      setHints: (dto.setHints ?? []).map((x) => x.trim()).filter(Boolean),
      brandHints: (dto.brandHints ?? []).map((x) => x.trim()).filter(Boolean),
      primaryWeaponHints: (dto.primaryWeaponHints ?? []).map((x) => x.trim()).filter(Boolean),
      secondaryWeaponHints: (dto.secondaryWeaponHints ?? []).map((x) => x.trim()).filter(Boolean),
      slotOverrides: this.sanitizeSlotOverrides(dto.slotOverrides),
      enabled: dto.enabled ?? true,
    };

    const exists = await this.prisma.recommendedBuildProfile.findUnique({ where: { id: normalized.id } });
    if (exists) normalized.id = slugifyId(`${normalized.name}_${normalized.id}`);

    const slotOverrides = normalized.slotOverrides ?? undefined;
    return this.prisma.recommendedBuildProfile.create({
      data: {
        id: normalized.id,
        name: normalized.name,
        description: normalized.description || null,
        focus: normalized.focus,
        preferredCore: normalized.preferredCore,
        enabled: normalized.enabled ?? true,
        order: 0,
        setHints: normalized.setHints ?? [],
        brandHints: normalized.brandHints ?? [],
        primaryWeaponHints: normalized.primaryWeaponHints ?? [],
        secondaryWeaponHints: normalized.secondaryWeaponHints ?? [],
        slotOverrides: (slotOverrides as any) ?? null,
      },
    });
  }

  async updateRecommendedProfileAdmin(id: string, dto: UpsertRecommendedBuildProfileDto) {
    const profileId = (id ?? "").trim();
    const exists = await this.prisma.recommendedBuildProfile.findUnique({ where: { id: profileId } });
    if (!exists) throw new NotFoundException("Recommended build profile not found");

    const normalized: RecommendedBuildProfile = {
      id: profileId,
      name: dto.name.trim(),
      description: (dto.description ?? "").trim(),
      focus: dto.focus as "DPS" | "Tank" | "Skill",
      preferredCore: dto.preferredCore as "Red" | "Blue" | "Yellow",
      setHints: (dto.setHints ?? []).map((x) => x.trim()).filter(Boolean),
      brandHints: (dto.brandHints ?? []).map((x) => x.trim()).filter(Boolean),
      primaryWeaponHints: (dto.primaryWeaponHints ?? []).map((x) => x.trim()).filter(Boolean),
      secondaryWeaponHints: (dto.secondaryWeaponHints ?? []).map((x) => x.trim()).filter(Boolean),
      slotOverrides: this.sanitizeSlotOverrides(dto.slotOverrides),
      enabled: dto.enabled ?? true,
    };

    const slotOverrides = normalized.slotOverrides ?? undefined;
    return this.prisma.recommendedBuildProfile.update({
      where: { id: profileId },
      data: {
        name: normalized.name,
        description: normalized.description || null,
        focus: normalized.focus,
        preferredCore: normalized.preferredCore,
        enabled: normalized.enabled ?? true,
        setHints: normalized.setHints ?? [],
        brandHints: normalized.brandHints ?? [],
        primaryWeaponHints: normalized.primaryWeaponHints ?? [],
        secondaryWeaponHints: normalized.secondaryWeaponHints ?? [],
        slotOverrides: (slotOverrides as any) ?? null,
      },
    });
  }

  // Backward-compat alias (old name used by controller previously).
  async upsertRecommendedProfileAdmin(dto: UpsertRecommendedBuildProfileDto) {
    return this.createRecommendedProfileAdmin(dto);
  }

  async deleteRecommendedProfileAdmin(id: string) {
    const profileId = (id ?? "").trim();
    const exists = await this.prisma.recommendedBuildProfile.findUnique({ where: { id: profileId } });
    if (!exists) throw new NotFoundException("Recommended build profile not found");
    await this.prisma.recommendedBuildProfile.delete({ where: { id: profileId } });
    return { ok: true };
  }

  async applyRecommended(id: string, dto: ApplyRecommendedBuildDto | undefined, ownerUserIdRaw: string) {
    const ownerUserId = this.normalizeUserId(ownerUserIdRaw);
    const recommended = await this.buildRecommendedBuilds();
    const rec = recommended.find((x) => x.id === id);
    if (!rec) throw new NotFoundException("Recommended build not found");

    const build = await this.prisma.build.create({
      data: {
        name: dto?.name ?? rec.name,
        patchVersion: dto?.patchVersion,
        ownerUserId,
        primaryWeaponId: rec.primaryWeaponId ?? undefined,
        secondaryWeaponId: rec.secondaryWeaponId ?? undefined,
        slots: {
          create: DEFAULT_SLOTS.map((slot) => {
            const selected = rec.slots.find((s) => s.slot === slot);
            return { slot, itemId: selected?.itemId ?? null };
          }),
        },
      },
      include: { slots: true },
    });
    return build;
  }

  async summary(id: string, userIdRaw: string) {
    const build = await this.get(id, userIdRaw);

    const items = build.slots.map((s: any) => s.item).filter(Boolean) as any[];

    const coreCounts = items.reduce((acc, it) => {
      const c = it.coreColor;
      if (c === "Red") acc.red++;
      else if (c === "Blue") acc.blue++;
      else if (c === "Yellow") acc.yellow++;
      return acc;
    }, { red: 0, blue: 0, yellow: 0 });

    // Brands
    const brandMap = new Map<string, { brandId: string; name: string; pieces: number; bonusesActive: string[] }>();
    for (const it of items) {
      if (!it.brandId) continue;
      const cur = brandMap.get(it.brandId) ?? { brandId: it.brandId, name: it.brand?.name ?? it.brandId, pieces: 0, bonusesActive: [] };
      cur.pieces += 1;
      brandMap.set(it.brandId, cur);
    }
    for (const v of brandMap.values()) {
      const brand = items.find(i => i.brandId === v.brandId)?.brand;
      if (brand?.bonus1 && v.pieces >= 1) v.bonusesActive.push(brand.bonus1);
      if (brand?.bonus2 && v.pieces >= 2) v.bonusesActive.push(brand.bonus2);
      if (brand?.bonus3 && v.pieces >= 3) v.bonusesActive.push(brand.bonus3);
    }

    // Gear sets
    const setMap = new Map<string, { setId: string; name: string; pieces: number; bonusesActive: string[] }>();
    for (const it of items) {
      if (!it.setId) continue;
      const cur = setMap.get(it.setId) ?? { setId: it.setId, name: it.gearSet?.name ?? it.setId, pieces: 0, bonusesActive: [] };
      cur.pieces += 1;
      setMap.set(it.setId, cur);
    }
    for (const v of setMap.values()) {
      const gs = items.find(i => i.setId === v.setId)?.gearSet;
      if (gs?.bonus2 && v.pieces >= 2) v.bonusesActive.push(gs.bonus2);
      if (gs?.bonus3 && v.pieces >= 3) v.bonusesActive.push(gs.bonus3);
      if (gs?.bonus4 && v.pieces >= 4) v.bonusesActive.push(gs.bonus4);
    }

    // Talents active
    const talents = [];
    for (const it of items) {
      if (it.talent) talents.push({ id: it.talent.id, name: it.talent.name, type: it.talent.type, description: it.talent.description });
    }

    return {
      buildId: id,
      coreCounts,
      brands: Array.from(brandMap.values()).sort((a,b) => b.pieces - a.pieces),
      gearSets: Array.from(setMap.values()).sort((a,b) => b.pieces - a.pieces),
      talents,
    };
  }

  private async buildRecommendedBuilds(): Promise<RecommendedBuildResult[]> {
    const dbProfiles = await this.prisma.recommendedBuildProfile.findMany({
      where: { enabled: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    const profiles: RecommendedBuildProfile[] = dbProfiles.length
      ? dbProfiles.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          focus: p.focus,
          preferredCore: p.preferredCore,
          enabled: p.enabled,
          setHints: p.setHints ?? [],
          brandHints: p.brandHints ?? [],
          primaryWeaponHints: p.primaryWeaponHints ?? [],
          secondaryWeaponHints: p.secondaryWeaponHints ?? [],
          slotOverrides: this.sanitizeSlotOverrides(p.slotOverrides as any),
        }))
      : DEFAULT_RECOMMENDED_PROFILES;
    const [gearItems, weapons] = await Promise.all([
      this.prisma.gearItem.findMany({
        where: { slot: { in: [...DEFAULT_SLOTS] } },
        include: { brand: true, gearSet: true },
      }),
      this.prisma.weapon.findMany(),
    ]);

    return profiles.map((profile) => this.materializeProfile(profile, gearItems, weapons));
  }

  private materializeProfile(profile: RecommendedBuildProfile, gearItems: any[], weapons: any[]): RecommendedBuildResult {
    const slots = DEFAULT_SLOTS.map((slot) => {
      const forcedItemId = profile.slotOverrides?.[slot];
      if (forcedItemId) {
        const forced = gearItems.find((it) => it.id === forcedItemId && it.slot === slot);
        if (forced) {
          return { slot, itemId: forced.id, itemName: forced.name };
        }
      }
      const bySlot = gearItems.filter((it) => it.slot === slot);
      const picked = this.pickBestGear(bySlot, profile);
      return { slot, itemId: picked?.id ?? null, itemName: picked?.name ?? null };
    });

    const primary = this.pickWeaponByClassHints(weapons, profile.primaryWeaponHints);
    const secondary = this.pickWeaponByClassHints(weapons, profile.secondaryWeaponHints, primary?.id);

    return {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      focus: profile.focus,
      preferredCore: profile.preferredCore,
      slots,
      primaryWeaponId: primary?.id ?? null,
      primaryWeaponName: primary?.name ?? null,
      secondaryWeaponId: secondary?.id ?? null,
      secondaryWeaponName: secondary?.name ?? null,
      filledSlots: slots.filter((x) => !!x.itemId).length,
      totalSlots: DEFAULT_SLOTS.length,
    };
  }

  private pickBestGear(items: any[], profile: RecommendedBuildProfile): any | null {
    if (!items.length) return null;

    const scored = items.map((it) => {
      let score = 0;
      const setKey = norm(it.gearSet?.name ?? it.setId);
      const brandKey = norm(it.brand?.name ?? it.brandId);

      if (it.coreColor === profile.preferredCore) score += 40;
      if (profile.setHints.some((hint) => setKey.includes(norm(hint)))) score += 35;
      if (profile.brandHints.some((hint) => brandKey.includes(norm(hint)))) score += 20;
      if (it.rarity === "Exotic") score += 8;
      if (it.rarity === "Named") score += 5;
      return { it, score };
    });

    scored.sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name));
    return scored[0]?.it ?? null;
  }

  private pickWeaponByClassHints(weapons: any[], hints: string[], excludeId?: string | null): any | null {
    const pool = excludeId ? weapons.filter((w) => w.id !== excludeId) : weapons;
    if (!pool.length) return null;
    for (const hint of hints) {
      const hit = pool.find((w) => norm(w.class) === norm(hint));
      if (hit) return hit;
    }
    return pool[0];
  }

  private sanitizeSlotOverrides(input?: Record<string, string>): Partial<Record<(typeof DEFAULT_SLOTS)[number], string>> | undefined {
    if (!input || typeof input !== "object") return undefined;
    const out: Partial<Record<(typeof DEFAULT_SLOTS)[number], string>> = {};
    for (const slot of DEFAULT_SLOTS) {
      const val = input[slot];
      if (typeof val === "string" && val.trim()) out[slot] = val.trim();
    }
    return Object.keys(out).length ? out : undefined;
  }
}
