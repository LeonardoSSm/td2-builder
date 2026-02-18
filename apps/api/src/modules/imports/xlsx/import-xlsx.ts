import * as ExcelJS from "exceljs";
import type { PrismaService } from "../../prisma/prisma.service";
import { randomUUID } from "crypto";
import {
  UpsertReport,
  asBool,
  asDate,
  asInt,
  asString,
  coreColorFromAttrName,
  findHeaderRowByTokens,
  findKeyByPrefixes,
  isJunkText,
  parseAttrNameValue,
  parseExtendedDetailEntries,
  parseWeaponClassFromGroup,
  parseWeaponClassFromType,
  pickValue,
  readSheetRows,
  readSheetRowsText,
  safeCellText,
  stripLeadSymbol,
} from "./xlsx.utils";

export type ImportProgress = { processedSteps: number; totalSteps: number; progress: number };

function autoId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export async function importXlsxBuffer(
  prisma: PrismaService,
  buffer: Buffer | Uint8Array,
  opts?: { onProgress?: (progress: ImportProgress) => void | Promise<void> },
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as any);

  const report: Record<string, UpsertReport> = {};
  const errors: Array<{ sheet: string; id?: string; error: string }> = [];

  const hasDiv2 =
    Boolean(workbook.getWorksheet("Weapons")) &&
    Boolean(workbook.getWorksheet("Brandsets")) &&
    Boolean(workbook.getWorksheet("Gearsets"));

  const totalSteps = hasDiv2 ? 21 : 8;
  let processedSteps = 0;

  const emitProgress = async () => {
    const progress = Math.round((processedSteps / totalSteps) * 100);
    if (opts?.onProgress) {
      await opts.onProgress({
        processedSteps,
        totalSteps,
        progress: Math.max(0, Math.min(100, progress)),
      });
    }
  };

  await emitProgress();

  const preloadExistingIds = async (model: any, ids: string[]): Promise<Set<string>> => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (!uniqueIds.length) return new Set<string>();
    const existing = await model.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    return new Set(existing.map((x: any) => x.id));
  };

  const run = async (sheetName: string, fn: (rows: any[], tx: any) => Promise<UpsertReport>) => {
    try {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) return;
      const rows = readSheetRows(ws);
      try {
        report[sheetName] = await prisma.$transaction((tx) => fn(rows, tx));
      } catch (e: any) {
        errors.push({ sheet: sheetName, error: e?.message ?? String(e) });
      }
    } finally {
      processedSteps += 1;
      await emitProgress();
    }
  };

  const runDiv2 = async (
    reportKey: string,
    sheetName: string,
    headerTokens: string[],
    fn: (rows: Array<Record<string, string>>, tx: any) => Promise<UpsertReport>,
  ) => {
    try {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) return;
      const headerRow = findHeaderRowByTokens(ws, headerTokens);
      if (!headerRow) return;
      const rows = readSheetRowsText(ws, headerRow);
      try {
        report[reportKey] = await prisma.$transaction((tx) => fn(rows, tx));
      } catch (e: any) {
        errors.push({ sheet: sheetName, error: e?.message ?? String(e) });
      }
    } finally {
      processedSteps += 1;
      await emitProgress();
    }
  };

  // SOURCES
  await run("SOURCES", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.source, rows.map((r) => asString(r["source_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["source_id"]);
      if (!id) continue;
      try {
        const data = {
          id,
          type: asString(r["type"]) ?? "other",
          reference: asString(r["reference"]),
          notes: asString(r["notes"]),
          lastUpdated: asDate(r["last_updated"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.source.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "SOURCES", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // BRANDS
  await run("BRANDS", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.brand, rows.map((r) => asString(r["brand_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["brand_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          bonus1: asString(r["bonus_1"]),
          bonus2: asString(r["bonus_2"]),
          bonus3: asString(r["bonus_3"]),
          wikiUrl: asString(r["wiki_url"]),
          logoUrl: asString(r["logo_url"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.brand.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "BRANDS", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // GEAR_SETS
  await run("GEAR_SETS", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.gearSet, rows.map((r) => asString(r["set_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["set_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          bonus2: asString(r["bonus_2"]),
          bonus3: asString(r["bonus_3"]),
          bonus4: asString(r["bonus_4"]),
          wikiUrl: asString(r["wiki_url"]),
          logoUrl: asString(r["logo_url"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.gearSet.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "GEAR_SETS", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // TALENTS
  await run("TALENTS", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.talent, rows.map((r) => asString(r["talent_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["talent_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          type: asString(r["type"]) ?? "Weapon",
          description: asString(r["description"]),
          cooldownS: asInt(r["cooldown_s"]),
          conditions: asString(r["conditions"]),
          wikiUrl: asString(r["wiki_url"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.talent.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "TALENTS", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // ATTRIBUTES
  await run("ATTRIBUTES", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.attribute, rows.map((r) => asString(r["attr_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["attr_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          category: asString(r["category"]) ?? "Offensive",
          unit: asString(r["unit"]) === "%" ? "PERCENT" : asString(r["unit"]) ?? "PERCENT",
          notes: asString(r["notes"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.attribute.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "ATTRIBUTES", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // ITEMS_GEAR
  await run("ITEMS_GEAR", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.gearItem, rows.map((r) => asString(r["item_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["item_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          slot: asString(r["slot"]) ?? "Mask",
          rarity: asString(r["rarity"]) ?? "HighEnd",
          brandId: asString(r["brand_id"]),
          setId: asString(r["set_id"]),
          isNamed: asBool(r["is_named"]) ?? false,
          isExotic: asBool(r["is_exotic"]) ?? false,
          coreColor: asString(r["core_color"]),
          coreCount: asInt(r["core_count"]),
          modSlots: asInt(r["mod_slots"]),
          talentId: asString(r["talent_id"]),
          imageUrl: asString(r["image_url"]),
          wikiUrl: asString(r["wiki_url"]),
          targetLootRef: asString(r["target_loot_ref"]),
          notes: asString(r["notes"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.gearItem.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "ITEMS_GEAR", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // ITEM_ATTR_RULES
  await run("ITEM_ATTR_RULES", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.itemAttrRule, rows.map((r) => asString(r["rule_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["rule_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          itemId: asString(r["item_id"])!,
          attrId: asString(r["attr_id"])!,
          isCore: asBool(r["is_core"]) ?? false,
          isMinor: asBool(r["is_minor"]) ?? false,
          minValue: asString(r["min_value"]),
          maxValue: asString(r["max_value"]),
          notes: asString(r["notes"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.itemAttrRule.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "ITEM_ATTR_RULES", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // WEAPONS
  await run("WEAPONS", async (rows, tx) => {
    let created = 0,
      updated = 0,
      errorsCount = 0;
    const existingIds = await preloadExistingIds(tx.weapon, rows.map((r) => asString(r["weapon_id"]) ?? ""));
    for (const r of rows) {
      const id = asString(r["weapon_id"]);
      if (!id) continue;
      try {
        const data: any = {
          id,
          name: asString(r["name"]) ?? id,
          class: asString(r["class"]) ?? "AR",
          rarity: asString(r["rarity"]) ?? "HighEnd",
          isNamed: asBool(r["is_named"]) ?? false,
          isExotic: asBool(r["is_exotic"]) ?? false,
          baseDamage: asString(pickValue(r, ["base_damage", "dano_base", "dano_base_arma", "base_damage_text"])),
          rpm: asInt(pickValue(r, ["rpm", "cadencia", "cadencia_rpm"])),
          magSize: asInt(pickValue(r, ["mag_size", "magazine_size", "tamanho_pente", "tamanho_do_pente"])),
          talentId: asString(r["talent_id"]),
          imageUrl: asString(r["image_url"]),
          wikiUrl: asString(r["wiki_url"]),
          targetLootRef: asString(r["target_loot_ref"]),
          notes: asString(r["notes"]),
          sourceId: asString(r["source_id"]),
          lastUpdated: asDate(r["last_updated"]),
          patchVersion: asString(r["patch_version"]),
        };
        const wasExisting = existingIds.has(id);
        await tx.weapon.upsert({ where: { id }, update: data, create: data });
        if (wasExisting) updated++;
        else {
          created++;
          existingIds.add(id);
        }
      } catch (e: any) {
        errorsCount++;
        errors.push({ sheet: "WEAPONS", id, error: e?.message ?? String(e) });
      }
    }
    return { created, updated, errors: errorsCount };
  });

  // Community sheet importers (DIV2_*)
  if (hasDiv2) {
    await runDiv2("DIV2_BRANDSETS", "Brandsets", ["Brand", "Core Attribute", "1pc"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.brand.findMany({ select: { id: true, name: true } });
      const byName = new Map<string, any>(existing.map((b: any) => [String(b.name).trim().toLowerCase(), b] as const));

      for (const r of rows) {
        const name = String((r as any)["brand_2"] ?? (r as any)["brand"] ?? "").trim();
        if (isJunkText(name)) continue;
        try {
          const bonus1 = String((r as any)["1pc"] ?? "").trim() || null;
          const bonus2 = String((r as any)["2pc"] ?? "").trim() || null;
          const bonus3 = String((r as any)["3pc"] ?? "").trim() || null;

          const key = name.toLowerCase();
          const hit = byName.get(key);
          if (hit) {
            await tx.brand.update({ where: { id: hit.id }, data: { name, bonus1, bonus2, bonus3 } });
            updated++;
          } else {
            const id = autoId("BRD_");
            const createdRow = await tx.brand.create({ data: { id, name, bonus1, bonus2, bonus3 } });
            byName.set(key, createdRow);
            created++;
          }
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Brandsets", id: name, error: e?.message ?? String(e) });
        }
      }
      return { created, updated, errors: errorsCount };
    });

    await runDiv2("DIV2_GEARSETS", "Gearsets", ["Name", "2pc", "3pc", "4pc"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.gearSet.findMany({ select: { id: true, name: true } });
      const byName = new Map<string, any>(existing.map((s: any) => [String(s.name).trim().toLowerCase(), s] as const));

      for (const r of rows) {
        const name = String((r as any)["name"] ?? "").trim();
        if (isJunkText(name)) continue;
        try {
          const core = String((r as any)["core_attr"] ?? (r as any)["core_attr_"] ?? (r as any)["core_attr."] ?? "").trim();
          const bonus2 = String((r as any)["2pc"] ?? "").trim() || null;
          const bonus3 = String((r as any)["3pc"] ?? "").trim() || null;
          const bonus4 = String((r as any)["4pc"] ?? "").trim() || null;
          const chestTalent = String((r as any)["chest_talent"] ?? "").trim();
          const backpackTalent = String((r as any)["backpack_talent"] ?? "").trim();
          const drop = String((r as any)["drop_location"] ?? "").trim();

          const descParts = [
            core ? `Core: ${core}` : null,
            drop ? `Drop: ${drop}` : null,
            !isJunkText(chestTalent) ? `Chest: ${chestTalent}` : null,
            !isJunkText(backpackTalent) ? `Backpack: ${backpackTalent}` : null,
          ].filter(Boolean) as string[];

          const description = descParts.length ? descParts.join(" | ") : null;

          const key = name.toLowerCase();
          const hit = byName.get(key);
          if (hit) {
            await tx.gearSet.update({ where: { id: hit.id }, data: { name, description, bonus2, bonus3, bonus4 } });
            updated++;
          } else {
            const id = autoId("SET_");
            const createdRow = await tx.gearSet.create({ data: { id, name, description, bonus2, bonus3, bonus4 } });
            byName.set(key, createdRow);
            created++;
          }
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Gearsets", id: name, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });

    await runDiv2("DIV2_WEAPON_TALENTS", "Weapon Talents", ["ALL WEAPONS", "Perfect Talent", "Description"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.talent.findMany({ select: { id: true, name: true, type: true } });
      const byKey = new Map<string, any>(existing.map((t: any) => [`${String(t.type)}|${String(t.name).trim().toLowerCase()}`, t] as const));

      const upsertTalentByName = async (nameRaw: string, description: string | null, type: string) => {
        const name = String(nameRaw ?? "").trim();
        if (isJunkText(name)) return;
        const key = `${type}|${name.toLowerCase()}`;
        const hit = byKey.get(key);
        if (hit) {
          await tx.talent.update({ where: { id: hit.id }, data: { name, type, description } });
          updated++;
        } else {
          const id = autoId("TLT_");
          const createdRow = await tx.talent.create({ data: { id, name, type, description } });
          byKey.set(key, createdRow);
          created++;
        }
      };

      for (const r of rows) {
        const base = String((r as any)["all_weapons"] ?? "").trim();
        const perfect = String((r as any)["perfect_talent"] ?? "").trim();
        const desc = String((r as any)["description"] ?? "").trim();
        if (isJunkText(base) && isJunkText(perfect)) continue;
        try {
          const description = isJunkText(desc) ? null : desc;
          await upsertTalentByName(base, description, "Weapon");
          await upsertTalentByName(perfect, description, "Weapon");
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Weapon Talents", id: base || perfect, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });

    await runDiv2("DIV2_GEAR_TALENTS", "Gear Talents", ["Category", "Talent", "Description"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.talent.findMany({ select: { id: true, name: true, type: true } });
      const byKey = new Map<string, any>(existing.map((t: any) => [`${String(t.type)}|${String(t.name).trim().toLowerCase()}`, t] as const));

      const upsertTalentByName = async (nameRaw: string, description: string | null, type: string) => {
        const name = String(nameRaw ?? "").trim();
        if (isJunkText(name)) return;
        const key = `${type}|${name.toLowerCase()}`;
        const hit = byKey.get(key);
        if (hit) {
          await tx.talent.update({ where: { id: hit.id }, data: { name, type, description } });
          updated++;
        } else {
          const id = autoId("TLT_");
          const createdRow = await tx.talent.create({ data: { id, name, type, description } });
          byKey.set(key, createdRow);
          created++;
        }
      };

      let currentType: "Chest" | "Backpack" = "Chest";
      for (const r of rows) {
        const col1 = String((r as any)["col_1"] ?? "").trim();
        if (/^chest talents/i.test(col1)) currentType = "Chest";
        if (/^backpack talents/i.test(col1)) currentType = "Backpack";

        const base = String((r as any)["talent"] ?? "").trim();
        const perfect = String((r as any)["perfect_talent"] ?? "").trim();
        const desc = String((r as any)["description"] ?? "").trim();
        if (isJunkText(base) && isJunkText(perfect)) continue;
        try {
          const description = isJunkText(desc) ? null : desc;
          await upsertTalentByName(base, description, currentType);
          await upsertTalentByName(perfect, description, currentType);
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Gear Talents", id: base || perfect, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });

    await runDiv2("DIV2_ATTRIBUTES", "Attribute Info", ["Slot", "Group", "Attribute", "Max"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.attribute.findMany({ select: { id: true, name: true, category: true, unit: true, notes: true } });
      const byName = new Map<string, any>(existing.map((a: any) => [String(a.name).trim().toLowerCase(), a] as const));

      const guessCategory = (slotRaw: string, groupRaw: string, attrName: string): "Offensive" | "Defensive" | "Utility" => {
        const slot = String(slotRaw ?? "").trim().toLowerCase();
        const group = String(groupRaw ?? "").trim().toLowerCase();
        const n = String(attrName ?? "").trim().toLowerCase();

        if (group.includes("defensive")) return "Defensive";
        if (group.includes("utility")) return "Utility";
        if (group.includes("offensive")) return "Offensive";

        if (n.includes("armor") || n.includes("armour") || n.includes("health")) return "Defensive";
        if (n.includes("skill")) return "Utility";

        if (slot === "weapon") {
          if (n.includes("reload") || n.includes("stability") || n.includes("accuracy") || n.includes("range") || n.includes("magazine") || n.includes("rate of fire") || n.includes("swap")) return "Utility";
          return "Offensive";
        }
        if (slot === "gear") {
          if (n.includes("skill")) return "Utility";
          if (n.includes("regen") || n.includes("incoming") || n.includes("hazard") || n.includes("resist")) return "Defensive";
          return "Offensive";
        }
        return "Offensive";
      };

      for (const r of rows) {
        const slot = String((r as any)["slot"] ?? "").trim();
        const group = String((r as any)["group"] ?? "").trim();
        const attrRaw = String((r as any)["attribute"] ?? "").trim();
        const maxRaw = String((r as any)["max"] ?? "").trim();
        if (isJunkText(slot) || isJunkText(group) || isJunkText(attrRaw) || isJunkText(maxRaw) || maxRaw.toLowerCase() === "na") continue;

        let name = attrRaw;
        let context: string | null = null;
        const idx = attrRaw.indexOf(":");
        if (idx > 0) {
          context = attrRaw.slice(0, idx).trim();
          name = attrRaw.slice(idx + 1).trim();
        }
        if (isJunkText(name) || name.toLowerCase() === "na") continue;

        const category = guessCategory(slot, group, name);
        const unit = maxRaw.includes("%") ? "PERCENT" : "FLAT";
        const notesParts = [
          `Slot: ${slot}`,
          `Group: ${group}`,
          context ? `Context: ${context}` : null,
          `Max: ${maxRaw}`,
        ].filter(Boolean) as string[];
        const notes = notesParts.join(" | ");

        try {
          const key = name.toLowerCase();
          const hit = byName.get(key);
          if (hit) {
            const data: any = {};
            if (!hit?.category && category) data.category = category;
            if (!hit?.unit && unit) data.unit = unit;
            if (!hit?.notes) data.notes = notes;
            if (Object.keys(data).length) {
              const updatedRow = await tx.attribute.update({ where: { id: hit.id }, data });
              byName.set(key, updatedRow);
              updated++;
            }
          } else {
            const id = autoId("ATR_");
            const createdRow = await tx.attribute.create({ data: { id, name, category, unit, notes } });
            byName.set(key, createdRow);
            created++;
          }
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Attribute Info", id: name, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });

    await runDiv2("DIV2_WEAPON_MODS", "Weapon Mods", ["Type", "Mod", "Bonus", "Source"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;

      const existing = await tx.weaponMod.findMany({ select: { id: true, name: true } });
      const byName = new Map<string, any>(existing.map((m: any) => [String(m.name).trim().toLowerCase(), m] as const));

      const getSourceValue = (row: Record<string, string>) => {
        const key = Object.keys(row).find((k) => k.startsWith("source"));
        return key ? String((row as any)[key] ?? "").trim() : "";
      };

      let currentType = "";
      let currentSlot = "";
      for (const r of rows) {
        const typeRaw = String((r as any)["type"] ?? "").trim();
        const slotRaw = String((r as any)["slot"] ?? "").trim();
        const name = String((r as any)["mod"] ?? "").trim();
        const bonus = String((r as any)["bonus"] ?? "").trim();
        const penalty = String((r as any)["penalty"] ?? "").trim();
        const source = getSourceValue(r);

        if (!isJunkText(typeRaw)) currentType = typeRaw;
        if (!isJunkText(slotRaw)) currentSlot = slotRaw;

        if (isJunkText(name)) continue;

        const type = !isJunkText(typeRaw) ? typeRaw : currentType || null;
        const slot = !isJunkText(slotRaw) ? slotRaw : currentSlot || null;

        try {
          const key = name.toLowerCase();
          const hit = byName.get(key);
          if (hit) {
            await tx.weaponMod.update({
              where: { id: hit.id },
              data: {
                name,
                type: type ?? null,
                slot: slot ?? null,
                bonus: isJunkText(bonus) ? null : bonus,
                penalty: isJunkText(penalty) ? null : penalty,
                source: isJunkText(source) ? null : source,
              },
            });
            updated++;
          } else {
            const id = autoId("WMD_");
            const createdRow = await tx.weaponMod.create({
              data: {
                id,
                name,
                type: type ?? null,
                slot: slot ?? null,
                bonus: isJunkText(bonus) ? null : bonus,
                penalty: isJunkText(penalty) ? null : penalty,
                source: isJunkText(source) ? null : source,
              },
            });
            byName.set(key, createdRow);
            created++;
          }
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Weapon Mods", id: name, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });

    // WEAPONS (base stats)
    await runDiv2("DIV2_WEAPONS", "Weapons", ["Variant", "Weapon", "RPM", "Base Mag Size", "Level 40 Damage"], async (rows, tx) => {
      let created = 0,
        updated = 0,
        errorsCount = 0;
      const existing = await tx.weapon.findMany({ select: { id: true, name: true, class: true, rarity: true } });
      const byKey = new Map<string, any>(existing.map((w: any) => [`${String(w.class)}|${String(w.rarity)}|${String(w.name).trim().toLowerCase()}`, w] as const));

      for (const r of rows) {
        const group = String((r as any)["col_1"] ?? "").trim();
        const weaponClass = parseWeaponClassFromGroup(group);
        const name = String((r as any)["weapon"] ?? "").trim();
        if (!weaponClass || isJunkText(name)) continue;
        try {
          const rpm = Number(String((r as any)["rpm"] ?? "").trim()) || undefined;
          const magSize = Number(String((r as any)["base_mag_size"] ?? "").trim()) || undefined;
          const baseDamageRaw = String((r as any)["level_40_damage"] ?? "").trim();
          const baseDamage = baseDamageRaw && !isJunkText(baseDamageRaw) ? baseDamageRaw : null;

          const totalMag = String((r as any)["total_mag"] ?? "").trim();
          const burstDps = String((r as any)["dps_(rps*dmg)"] ?? "").trim();
          const sustainDps = String((r as any)["sustain_dps_(dmg/time)"] ?? "").trim();
          const optimalRange = String((r as any)["optimal_range"] ?? "").trim();
          const modSlotsRaw = String((r as any)["mod_slots**"] ?? "").trim();
          const hsdRaw = String((r as any)["hsd"] ?? "").trim();
          const fixedSecond = String((r as any)["fixed_second_attribute"] ?? "").trim();
          const fixedThird = String((r as any)["fixed_third_attribute"] ?? "").trim();

          const extra = {
            totalMag: isJunkText(totalMag) ? null : totalMag,
            burstDps: isJunkText(burstDps) ? null : burstDps,
            sustainDps: isJunkText(sustainDps) ? null : sustainDps,
            optimalRange: isJunkText(optimalRange) ? null : optimalRange,
            modSlots: isJunkText(modSlotsRaw) ? null : modSlotsRaw,
            headshotDamage: isJunkText(hsdRaw) ? null : hsdRaw,
            fixedSecond: isJunkText(fixedSecond) ? null : fixedSecond,
            fixedThird: isJunkText(fixedThird) ? null : fixedThird,
          };

          const key = `${weaponClass}|HighEnd|${name.toLowerCase()}`;
          const hit = byKey.get(key);
          const notes = JSON.stringify({ _kind: "td2_extended_item_details", detailEntries: [{ kind: "weapon_sheet", data: extra }] });

          if (hit) {
            await tx.weapon.update({
              where: { id: hit.id },
              data: {
                name,
                class: weaponClass,
                rarity: hit.rarity ?? "HighEnd",
                rpm: Number.isFinite(rpm as any) ? Math.trunc(rpm as any) : null,
                magSize: Number.isFinite(magSize as any) ? Math.trunc(magSize as any) : null,
                baseDamage,
                notes,
              },
            });
            updated++;
          } else {
            const id = autoId("WPN_");
            const createdRow = await tx.weapon.create({
              data: {
                id,
                name,
                class: weaponClass,
                rarity: "HighEnd",
                rpm: Number.isFinite(rpm as any) ? Math.trunc(rpm as any) : null,
                magSize: Number.isFinite(magSize as any) ? Math.trunc(magSize as any) : null,
                baseDamage,
                notes,
              },
            });
            byKey.set(key, createdRow);
            created++;
          }
        } catch (e: any) {
          errorsCount++;
          errors.push({ sheet: "Weapons", id: name, error: e?.message ?? String(e) });
        }
      }

      return { created, updated, errors: errorsCount };
    });
  }

  processedSteps = totalSteps;
  await emitProgress();
  return { ok: errors.length === 0, report, errors };
}
