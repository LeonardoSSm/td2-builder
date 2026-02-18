import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
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
} from "./xlsx/xlsx.utils";

type ImportJobStatus = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
type ImportProgress = { processedSteps: number; totalSteps: number; progress: number };

function autoId(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

// NOTE: XLSX import logic was extracted to ./xlsx/import-xlsx.ts

@Injectable()
export class ImportsService implements OnModuleInit {
  private readonly importDir = join(process.cwd(), "data", "import-jobs");
  private readonly queue: string[] = [];
  private workerRunning = false;

  constructor(private readonly prisma: PrismaService) {
    mkdirSync(this.importDir, { recursive: true });
  }

  async onModuleInit() {
    try {
      const pending = await this.jobsModel().findMany({
        where: { status: { in: ["QUEUED", "PROCESSING"] } },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      for (const job of pending) {
        this.pushQueue(String(job.id));
      }
    } catch {
      // ignore; import queue will still work for new jobs
    }
  }

  private jobsModel(): any {
    return (this.prisma as any).importJob;
  }

  private toPublicJob(job: any) {
    if (!job) return null;
    return {
      id: job.id,
      kind: job.kind,
      filename: job.filename,
      mimeType: job.mimeType,
      sizeBytes: job.sizeBytes,
      status: job.status,
      progress: job.progress,
      totalSteps: job.totalSteps,
      processedSteps: job.processedSteps,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      report: job.report ?? null,
      error: job.error ?? null,
      requestedBy: job.requestedBy ?? null,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async listJobs(limitRaw?: number) {
    const limit = Math.max(1, Math.min(50, Math.trunc(Number(limitRaw) || 20)));
    const rows = await this.jobsModel().findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((x: any) => this.toPublicJob(x));
  }

  async getJob(idRaw: string) {
    const id = String(idRaw ?? "").trim();
    if (!id) return null;
    const row = await this.jobsModel().findUnique({ where: { id } });
    return this.toPublicJob(row);
  }

  async enqueueXlsx(file: { originalname?: string; mimetype?: string; size?: number; buffer: Buffer }, requestedBy?: string | null) {
    const id = autoId("IMP_");
    const filePath = join(this.importDir, `${id}.xlsx`);
    writeFileSync(filePath, file.buffer);

    const created = await this.jobsModel().create({
      data: {
        id,
        kind: "xlsx",
        filename: String(file.originalname ?? "upload.xlsx").trim() || "upload.xlsx",
        mimeType: String(file.mimetype ?? "").trim() || null,
        sizeBytes: Number.isFinite(Number(file.size)) ? Math.max(0, Math.trunc(Number(file.size))) : null,
        status: "QUEUED",
        progress: 0,
        totalSteps: 21,
        processedSteps: 0,
        attempt: 0,
        maxAttempts: 3,
        error: null,
        report: null,
        requestedBy: String(requestedBy ?? "").trim() || null,
        filePath,
      },
    });

    this.pushQueue(id);
    return this.toPublicJob(created);
  }

  async retryJob(idRaw: string) {
    const id = String(idRaw ?? "").trim();
    if (!id) return { ok: false, error: "id is required" };
    const row = await this.jobsModel().findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Import job not found" };
    if (!row.filePath || !existsSync(row.filePath)) {
      return { ok: false, error: "Original uploaded file not found for retry" };
    }
    if (Number(row.attempt ?? 0) >= Number(row.maxAttempts ?? 3)) {
      return { ok: false, error: "Max attempts reached for this job" };
    }

    await this.jobsModel().update({
      where: { id },
      data: {
        status: "QUEUED",
        progress: 0,
        processedSteps: 0,
        totalSteps: 21,
        error: null,
        report: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    this.pushQueue(id);
    const next = await this.jobsModel().findUnique({ where: { id } });
    return { ok: true, job: this.toPublicJob(next) };
  }

  private pushQueue(id: string) {
    if (!this.queue.includes(id)) this.queue.push(id);
    void this.drainQueue();
  }

  private async drainQueue() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      while (this.queue.length) {
        const nextId = this.queue.shift();
        if (!nextId) continue;
        await this.processJob(nextId);
      }
    } finally {
      this.workerRunning = false;
    }
  }

  private async updateJobProgress(jobId: string, payload: ImportProgress) {
    const progress = Math.max(0, Math.min(100, Math.trunc(payload.progress)));
    const totalSteps = Math.max(1, Math.trunc(payload.totalSteps || 1));
    const processedSteps = Math.max(0, Math.min(totalSteps, Math.trunc(payload.processedSteps || 0)));
    await this.jobsModel().update({
      where: { id: jobId },
      data: { progress, totalSteps, processedSteps },
    });
  }

  private async processJob(id: string) {
    const job = await this.jobsModel().findUnique({ where: { id } });
    if (!job) return;
    if (job.status === "PROCESSING") return;
    if (job.status === "DONE") return;

    await this.jobsModel().update({
      where: { id },
      data: {
        status: "PROCESSING" as ImportJobStatus,
        progress: 1,
        totalSteps: 21,
        processedSteps: 0,
        startedAt: new Date(),
        finishedAt: null,
        error: null,
        attempt: (Number(job.attempt ?? 0) + 1),
      },
    });

    try {
      if (!job.filePath || !existsSync(job.filePath)) {
        throw new Error("Queued file was not found on disk");
      }

      const payload = readFileSync(job.filePath);
      const result = await this.importXlsxBuffer(payload, {
        onProgress: async (p) => {
          await this.updateJobProgress(id, p);
        },
      });

      await this.jobsModel().update({
        where: { id },
        data: {
          status: "DONE" as ImportJobStatus,
          progress: 100,
          report: result,
          error: null,
          finishedAt: new Date(),
        },
      });
    } catch (e: any) {
      await this.jobsModel().update({
        where: { id },
        data: {
          status: "FAILED" as ImportJobStatus,
          error: String(e?.message ?? e ?? "Unknown import error"),
          finishedAt: new Date(),
        },
      });
    }
  }

  async importXlsxBuffer(
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

    const run = async (sheetName: string, fn: (rows: any[], tx: any) => Promise<UpsertReport>) => {
      try {
        const ws = workbook.getWorksheet(sheetName);
        if (!ws) return;
        const rows = readSheetRows(ws);
        try {
          report[sheetName] = await this.prisma.$transaction((tx) => fn(rows, tx));
        } catch (e: any) {
          errors.push({ sheet: sheetName, error: e?.message ?? String(e) });
        }
      } finally {
        processedSteps += 1;
        await emitProgress();
      }
    };

    const preloadExistingIds = async (model: any, ids: string[]): Promise<Set<string>> => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (!uniqueIds.length) return new Set<string>();
      const existing = await model.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      return new Set(existing.map((x: any) => x.id));
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
          report[reportKey] = await this.prisma.$transaction((tx) => fn(rows, tx));
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
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "SOURCES", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // BRANDS
    await run("BRANDS", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
              notes: undefined, // not in schema
            };
            const wasExisting = existingIds.has(id);
            await tx.brand.upsert({ where: { id }, update: data, create: data });
            if (wasExisting) updated++;
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "BRANDS", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // GEAR_SETS
    await run("GEAR_SETS", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "GEAR_SETS", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // TALENTS
    await run("TALENTS", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "TALENTS", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // ATTRIBUTES
    await run("ATTRIBUTES", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "ATTRIBUTES", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // ITEMS_GEAR
    await run("ITEMS_GEAR", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "ITEMS_GEAR", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // ITEM_ATTR_RULES
    await run("ITEM_ATTR_RULES", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "ITEM_ATTR_RULES", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // WEAPONS
    await run("WEAPONS", async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
              // Accept a few common header variants (pt/en) besides the canonical keys.
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
            else { created++; existingIds.add(id); }
          } catch (e: any) { errorsCount++; errors.push({ sheet: "WEAPONS", id, error: e?.message ?? String(e) }); }
        }
        return { created, updated, errors: errorsCount };
      });

    // Division 2 Gear Spreadsheet (community sheet) support.
    // We import the most useful tables by *name* with auto-generated IDs.
    if (hasDiv2) {
      // BRANDS (Brandsets)
      await runDiv2("DIV2_BRANDSETS", "Brandsets", ["Brand", "Core Attribute", "1pc"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
        const existing = await tx.brand.findMany({ select: { id: true, name: true } });
        const byName = new Map<string, any>(existing.map((b: any) => [String(b.name).trim().toLowerCase(), b] as const));

        for (const r of rows) {
          const name = String(r["brand_2"] ?? r["brand"] ?? "").trim();
          if (isJunkText(name)) continue;
          try {
            const bonus1 = String(r["1pc"] ?? "").trim() || null;
            const bonus2 = String(r["2pc"] ?? "").trim() || null;
            const bonus3 = String(r["3pc"] ?? "").trim() || null;

            const key = name.toLowerCase();
            const hit = byName.get(key);
            if (hit) {
              await tx.brand.update({
                where: { id: hit.id },
                data: {
                  name,
                  bonus1,
                  bonus2,
                  bonus3,
                },
              });
              updated++;
            } else {
              const id = autoId("BRD_");
              const createdRow = await tx.brand.create({
                data: {
                  id,
                  name,
                  bonus1,
                  bonus2,
                  bonus3,
                },
              });
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

      // GEARSETS (Gearsets)
      await runDiv2("DIV2_GEARSETS", "Gearsets", ["Name", "2pc", "3pc", "4pc"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
        const existing = await tx.gearSet.findMany({ select: { id: true, name: true } });
        const byName = new Map<string, any>(existing.map((s: any) => [String(s.name).trim().toLowerCase(), s] as const));

        for (const r of rows) {
          const name = String(r["name"] ?? "").trim();
          if (isJunkText(name)) continue;

          try {
            const core = String(r["core_attr"] ?? r["core_attr_"] ?? r["core_attr."] ?? "").trim();
            const bonus2 = String(r["2pc"] ?? "").trim() || null;
            const bonus3 = String(r["3pc"] ?? "").trim() || null;
            const bonus4 = String(r["4pc"] ?? "").trim() || null;
            const chestTalent = String(r["chest_talent"] ?? "").trim();
            const backpackTalent = String(r["backpack_talent"] ?? "").trim();
            const drop = String(r["drop_location"] ?? "").trim();

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
              await tx.gearSet.update({
                where: { id: hit.id },
                data: {
                  name,
                  description,
                  bonus2,
                  bonus3,
                  bonus4,
                },
              });
              updated++;
            } else {
              const id = autoId("SET_");
              const createdRow = await tx.gearSet.create({
                data: { id, name, description, bonus2, bonus3, bonus4 },
              });
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

      // WEAPON TALENTS (Weapon Talents)
      await runDiv2("DIV2_WEAPON_TALENTS", "Weapon Talents", ["ALL WEAPONS", "Perfect Talent", "Description"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
        const existing = await tx.talent.findMany({ select: { id: true, name: true, type: true } });
        const byKey = new Map<string, any>(
          existing.map((t: any) => [`${String(t.type)}|${String(t.name).trim().toLowerCase()}`, t] as const),
        );

        const upsertTalentByName = async (nameRaw: string, description: string | null, type: string) => {
          const name = String(nameRaw ?? "").trim();
          if (isJunkText(name)) return;
          const key = `${type}|${name.toLowerCase()}`;
          const hit = byKey.get(key);
          if (hit) {
            await tx.talent.update({
              where: { id: hit.id },
              data: { name, type, description },
            });
            updated++;
          } else {
            const id = autoId("TLT_");
            const createdRow = await tx.talent.create({ data: { id, name, type, description } });
            byKey.set(key, createdRow);
            created++;
          }
        };

        for (const r of rows) {
          const base = String(r["all_weapons"] ?? "").trim();
          const perfect = String(r["perfect_talent"] ?? "").trim();
          const desc = String(r["description"] ?? "").trim();
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

      // GEAR TALENTS (Gear Talents)
      await runDiv2("DIV2_GEAR_TALENTS", "Gear Talents", ["Category", "Talent", "Description"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
        const existing = await tx.talent.findMany({ select: { id: true, name: true, type: true } });
        const byKey = new Map<string, any>(
          existing.map((t: any) => [`${String(t.type)}|${String(t.name).trim().toLowerCase()}`, t] as const),
        );

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
          const col1 = String(r["col_1"] ?? "").trim();
          if (/^chest talents/i.test(col1)) currentType = "Chest";
          if (/^backpack talents/i.test(col1)) currentType = "Backpack";

          const base = String(r["talent"] ?? "").trim();
          const perfect = String(r["perfect_talent"] ?? "").trim();
          const desc = String(r["description"] ?? "").trim();
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

      // ATTRIBUTES (Attribute Info)
      await runDiv2("DIV2_ATTRIBUTES", "Attribute Info", ["Slot", "Group", "Attribute", "Max"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;
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
          const slot = String(r["slot"] ?? "").trim();
          const group = String(r["group"] ?? "").trim();
          const attrRaw = String(r["attribute"] ?? "").trim();
          const maxRaw = String(r["max"] ?? "").trim();
          if (isJunkText(slot) || isJunkText(group) || isJunkText(attrRaw) || isJunkText(maxRaw) || maxRaw.toLowerCase() === "na") continue;

          // Remove prefixes like "Assault Rifle: Health Damage" and "All weapons: Weapon damage".
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

      // WEAPON MODS (Weapon Mods)
      await runDiv2("DIV2_WEAPON_MODS", "Weapon Mods", ["Type", "Mod", "Bonus", "Source"], async (rows, tx) => {
        let created = 0, updated = 0, errorsCount = 0;

        const existing = await tx.weaponMod.findMany({ select: { id: true, name: true } });
        const byName = new Map<string, any>(existing.map((m: any) => [String(m.name).trim().toLowerCase(), m] as const));

        const getSourceValue = (row: Record<string, string>) => {
          const key = Object.keys(row).find((k) => k.startsWith("source"));
          return key ? String(row[key] ?? "").trim() : "";
        };

        let currentType = "";
        let currentSlot = "";
        for (const r of rows) {
          const typeRaw = String(r["type"] ?? "").trim();
          const slotRaw = String(r["slot"] ?? "").trim();
          const name = String(r["mod"] ?? "").trim();
          const bonus = String(r["bonus"] ?? "").trim();
          const penalty = String(r["penalty"] ?? "").trim();
          const source = getSourceValue(r);

          if (!isJunkText(typeRaw)) currentType = typeRaw;
          if (!isJunkText(slotRaw)) currentSlot = slotRaw;

          if (isJunkText(name)) continue;

          const type = !isJunkText(typeRaw) ? typeRaw : (currentType || null);
          const slot = !isJunkText(slotRaw) ? slotRaw : (currentSlot || null);

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
        let created = 0, updated = 0, errorsCount = 0;
        const existing = await tx.weapon.findMany({ select: { id: true, name: true, class: true, rarity: true } });
        const byKey = new Map<string, any>(
          existing.map((w: any) => [`${String(w.class)}|${String(w.rarity)}|${String(w.name).trim().toLowerCase()}`, w]),
        );

        for (const r of rows) {
          const group = String(r["col_1"] ?? "").trim();
          const weaponClass = parseWeaponClassFromGroup(group);
          const name = String(r["weapon"] ?? "").trim();
          if (!weaponClass || isJunkText(name)) continue;
          try {
            const rpm = asInt(r["rpm"]);
            const magSize = asInt(r["base_mag_size"]);
            const baseDamageRaw = String(r["level_40_damage"] ?? "").trim();
            const baseDamage = baseDamageRaw && !isJunkText(baseDamageRaw) ? baseDamageRaw : null;

            const totalMag = String(r["total_mag"] ?? "").trim();
            const burstDps = String(r["dps_(rps*dmg)"] ?? "").trim();
            const sustainDps = String(r["sustain_dps_(dmg/time)"] ?? "").trim();
            const optimalRange = String(r["optimal_range"] ?? "").trim();
            const modSlotsRaw = String(r["mod_slots**"] ?? "").trim();
            const hsdRaw = String(r["hsd"] ?? "").trim();
            const fixedSecond = String(r["fixed_second_attribute"] ?? "").trim();
            const emptyReload = String(r["empty_reload_(secs)"] ?? "").trim();

            const detailEntries: any[] = [];
            const push = (group: string, key: string, value: string, unit?: string) => {
              const v = String(value ?? "").trim();
              if (isJunkText(v)) return;
              detailEntries.push({ group, key, value: v, unit: unit ?? undefined });
            };

            push("weapon_stats", "TotalDamage", totalMag);
            push("weapon_stats", "PNT", burstDps);
            push("weapon_stats", "DPM", sustainDps);
            push("weapon_stats", "OptimalRange", optimalRange);
            if (!isJunkText(hsdRaw)) push("weapon_stats", "HeadshotDamagePct", hsdRaw.includes("%") ? hsdRaw : `${hsdRaw}%`);
            if (!isJunkText(emptyReload)) push("weapon_stats", "EmptyReloadS", emptyReload, "s");

            push("weapon_config", "AtributoCentral", "Weapon Damage");
            push("weapon_config", "Atributo", fixedSecond);
            push("weapon_config", "ModSlots", modSlotsRaw);

            const notes =
              detailEntries.length > 0
                ? JSON.stringify({
                    _kind: "td2_extended_item_details",
                    detailEntries,
                  })
                : null;

            const rarity = "HighEnd";
            const key = `${weaponClass}|${rarity}|${name.toLowerCase()}`;
            const hit = byKey.get(key);
            if (hit) {
              await tx.weapon.update({
                where: { id: hit.id },
                data: { name, class: weaponClass, rarity, rpm: rpm ?? null, magSize: magSize ?? null, baseDamage, notes: notes ?? undefined },
              });
              updated++;
            } else {
              const id = autoId("WPN_");
              const createdRow = await tx.weapon.create({
                data: { id, name, class: weaponClass, rarity, rpm: rpm ?? null, magSize: magSize ?? null, baseDamage, notes: notes ?? undefined },
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

      // SKILLS (Skill List)
      await runDiv2(
        "DIV2_SKILLS",
        "Skill List",
        ["Skill", "Variant", "Stat", "Skill Tier 1", "Skill Tier 6"],
        async (rows, tx) => {
          let created = 0, updated = 0, errorsCount = 0;

          const existingFamilies = await tx.skillFamily.findMany({ select: { id: true, name: true } });
          const familyByName = new Map<string, any>(
            existingFamilies.map((f: any) => [String(f.name).trim().toLowerCase(), f] as const),
          );

          const existingVariants = await tx.skillVariant.findMany({
            select: { id: true, familyId: true, name: true, availability: true },
          });
          const variantByKey = new Map<string, any>(
            existingVariants.map((v: any) => [`${v.familyId}|${String(v.name).trim().toLowerCase()}`, v] as const),
          );

          const ensureFamily = async (nameRaw: string, availability?: string | null): Promise<string | null> => {
            const name = String(nameRaw ?? "").trim();
            if (isJunkText(name)) return null;
            const key = name.toLowerCase();
            const hit = familyByName.get(key);
            if (hit) {
              if (availability && !hit.availability) {
                const updatedRow = await tx.skillFamily.update({ where: { id: hit.id }, data: { availability } });
                familyByName.set(key, updatedRow);
                updated++;
              }
              return hit.id;
            }
            const id = autoId("SKL_");
            const createdRow = await tx.skillFamily.create({
              data: { id, name, availability: availability || null },
            });
            familyByName.set(key, createdRow);
            created++;
            return id;
          };

          const ensureVariant = async (familyId: string, nameRaw: string, availability?: string | null): Promise<string | null> => {
            const name = String(nameRaw ?? "").trim();
            if (isJunkText(name)) return null;
            const key = `${familyId}|${name.toLowerCase()}`;
            const hit = variantByKey.get(key);
            if (hit) {
              if (availability && !hit.availability) {
                const updatedRow = await tx.skillVariant.update({ where: { id: hit.id }, data: { availability } });
                variantByKey.set(key, updatedRow);
                updated++;
              }
              return hit.id;
            }
            const id = autoId("SKV_");
            const createdRow = await tx.skillVariant.create({
              data: { id, familyId, name, availability: availability || null },
            });
            variantByKey.set(key, createdRow);
            created++;
            return id;
          };

          // Identify dynamic columns.
          const sample = rows[0] ?? {};
          const tier0Key = Object.keys(sample).find((k) => k.includes("tier_0")) ?? "base_stats_/_skill_tier_0";
          const tier1Key = Object.keys(sample).find((k) => k.includes("tier_1")) ?? "skill_tier_1";
          const tier2Key = Object.keys(sample).find((k) => k.includes("tier_2")) ?? "skill_tier_2";
          const tier3Key = Object.keys(sample).find((k) => k.includes("tier_3")) ?? "skill_tier_3";
          const tier4Key = Object.keys(sample).find((k) => k.includes("tier_4")) ?? "skill_tier_4";
          const tier5Key = Object.keys(sample).find((k) => k.includes("tier_5")) ?? "skill_tier_5";
          const tier6Key = Object.keys(sample).find((k) => k.includes("tier_6")) ?? "skill_tier_6";

          const overStatsKey = findKeyByPrefixes(sample, ["overcharge_stats"]);
          const overFxKey = findKeyByPrefixes(sample, ["overcharge_effects"]);
          const expertiseKey = findKeyByPrefixes(sample, ["expertise_grades"]);

          // Pass 1: quick links (variant listing + availability)
          for (const r of rows) {
            const stat = String(r["stat"] ?? "").trim();
            if (!stat || !stat.startsWith("▶")) continue;
            const skillName = stripLeadSymbol(stat);
            if (isJunkText(skillName)) continue;

            const availabilityRaw =
              String(r[tier5Key] ?? "").trim() ||
              String(r[tier6Key] ?? "").trim() ||
              null;
            const availability = !isJunkText(availabilityRaw || "") ? availabilityRaw : null;

            const familyId = await ensureFamily(skillName, availability);
            if (!familyId) continue;

            const variantCandidates = [
              String(r[tier0Key] ?? "").trim(),
              String(r[tier1Key] ?? "").trim(),
              String(r[tier2Key] ?? "").trim(),
              String(r[tier3Key] ?? "").trim(),
              String(r[tier4Key] ?? "").trim(),
            ]
              .map((x) => String(x ?? "").trim())
              .filter((x) => !isJunkText(x))
              .filter((x) => !/(base game|warlords|battle for brooklyn)/i.test(x));

            for (const v of variantCandidates) {
              await ensureVariant(familyId, v, availability);
            }
          }

          // Pass 2: stats rows
          const statsByVariant = new Map<string, Array<any>>();
          let currentSkill = "";
          let currentVariant = "";
          let order = 0;

          for (const r of rows) {
            const skillRaw = String(r["skill"] ?? "").trim();
            const variantRaw = String(r["variant"] ?? "").trim();
            const statRaw = String(r["stat"] ?? "").trim();

            if (statRaw.startsWith("▶")) continue; // quick links area

            if (!isJunkText(skillRaw)) currentSkill = skillRaw;
            if (!isJunkText(variantRaw)) currentVariant = variantRaw;

            const skill = String(currentSkill ?? "").trim();
            const variant = String(currentVariant ?? "").trim();
            const stat = String(statRaw ?? "").trim();

            if (isJunkText(skill) || isJunkText(variant) || isJunkText(stat)) continue;

            try {
              const familyId = await ensureFamily(skill, null);
              if (!familyId) continue;
              const variantId = await ensureVariant(familyId, variant, null);
              if (!variantId) continue;

              const rowData = {
                variantId,
                stat,
                tier0: asString(r[tier0Key]) ?? null,
                tier1: asString(r[tier1Key]) ?? null,
                tier2: asString(r[tier2Key]) ?? null,
                tier3: asString(r[tier3Key]) ?? null,
                tier4: asString(r[tier4Key]) ?? null,
                tier5: asString(r[tier5Key]) ?? null,
                tier6: asString(r[tier6Key]) ?? null,
                overchargeStats: overStatsKey ? (asString(r[overStatsKey]) ?? null) : null,
                overchargeEffects: overFxKey ? (asString(r[overFxKey]) ?? null) : null,
                expertiseGrades: expertiseKey ? (asString(r[expertiseKey]) ?? null) : null,
                order: order++,
              };

              const list = statsByVariant.get(variantId) ?? [];
              list.push(rowData);
              statsByVariant.set(variantId, list);
            } catch (e: any) {
              errorsCount++;
              errors.push({ sheet: "Skill List", id: `${skill} / ${variant} / ${stat}`, error: e?.message ?? String(e) });
            }
          }

          // Replace stats per variant (keeps ordering).
          for (const [variantId, statsData] of statsByVariant.entries()) {
            try {
              await tx.skillVariantStat.deleteMany({ where: { variantId } });
              if (statsData.length) {
                await tx.skillVariantStat.createMany({ data: statsData });
              }
              updated += statsData.length; // count as updated rows
            } catch (e: any) {
              errorsCount++;
              errors.push({ sheet: "Skill List", id: variantId, error: e?.message ?? String(e) });
            }
          }

          return { created, updated, errors: errorsCount };
        },
      );

      // SPECIALIZATIONS (Specializations)
      // This sheet is laid out in blocks with 2 specializations side-by-side.
      await (async () => {
        const ws = workbook.getWorksheet("Specializations");
        if (!ws) return;

        const reportKey = "DIV2_SPECIALIZATIONS";
        try {
          report[reportKey] = await this.prisma.$transaction(async (tx) => {
            let created = 0, updated = 0, errorsCount = 0;

            const existing = await tx.specialization.findMany({ select: { id: true, name: true } });
            const byName = new Map<string, any>(existing.map((s: any) => [String(s.name).trim().toLowerCase(), s] as const));

            const ensureSpec = async (nameRaw: string): Promise<string | null> => {
              const name = String(nameRaw ?? "").trim();
              if (isJunkText(name)) return null;
              const key = name.toLowerCase();
              const hit = byName.get(key);
              if (hit) return hit.id;
              const id = autoId("SPC_");
              const createdRow = await tx.specialization.create({ data: { id, name } });
              byName.set(key, createdRow);
              created++;
              return id;
            };

            // Find block header rows (row where col2 and col5 are specialization names).
            const blockStarts: number[] = [];
            for (let r = 1; r <= (ws.rowCount || 1); r++) {
              const a = safeCellText(ws.getRow(r).getCell(2));
              const b = safeCellText(ws.getRow(r).getCell(5));
              if (!isJunkText(a) && !isJunkText(b)) {
                // Heuristic: header row repeats the name in next column.
                const a2 = safeCellText(ws.getRow(r).getCell(3));
                const b2 = safeCellText(ws.getRow(r).getCell(6));
                if (String(a).trim() === String(a2).trim() && String(b).trim() === String(b2).trim()) {
                  blockStarts.push(r);
                }
              }
            }
            if (!blockStarts.length) return { created, updated, errors: errorsCount };

            const allSpecNodes: Map<string, any[]> = new Map(); // specId -> nodes

            for (let i = 0; i < blockStarts.length; i++) {
              const start = blockStarts[i];
              const end = (i + 1 < blockStarts.length ? blockStarts[i + 1] : ws.rowCount + 1);

              const specA = safeCellText(ws.getRow(start).getCell(2));
              const specB = safeCellText(ws.getRow(start).getCell(5));
              const specAId = await ensureSpec(specA);
              const specBId = await ensureSpec(specB);
              if (!specAId || !specBId) continue;

              // Data rows start after the first few header rows of each block.
              let ordA = 0;
              let ordB = 0;
              for (let r = start + 1; r < end; r++) {
                const row = ws.getRow(r);
                const gA = safeCellText(row.getCell(1));
                const nA = safeCellText(row.getCell(2));
                const dA = safeCellText(row.getCell(3));
                const gB = safeCellText(row.getCell(4));
                const nB = safeCellText(row.getCell(5));
                const dB = safeCellText(row.getCell(6));

                if (!isJunkText(nA) && !isJunkText(gA)) {
                  const list = allSpecNodes.get(specAId) ?? [];
                  list.push({
                    specId: specAId,
                    group: gA,
                    kind: null,
                    name: nA,
                    description: isJunkText(dA) ? null : dA,
                    order: ordA++,
                  });
                  allSpecNodes.set(specAId, list);
                }
                if (!isJunkText(nB) && !isJunkText(gB)) {
                  const list = allSpecNodes.get(specBId) ?? [];
                  list.push({
                    specId: specBId,
                    group: gB,
                    kind: null,
                    name: nB,
                    description: isJunkText(dB) ? null : dB,
                    order: ordB++,
                  });
                  allSpecNodes.set(specBId, list);
                }
              }
            }

            for (const [specId, nodes] of allSpecNodes.entries()) {
              try {
                await tx.specializationNode.deleteMany({ where: { specId } });
                if (nodes.length) await tx.specializationNode.createMany({ data: nodes });
                updated += nodes.length;
              } catch (e: any) {
                errorsCount++;
                errors.push({ sheet: "Specializations", id: specId, error: e?.message ?? String(e) });
              }
            }

            return { created, updated, errors: errorsCount };
          });
        } catch (e: any) {
          errors.push({ sheet: "Specializations", error: e?.message ?? String(e) });
        }
      })();

      // HUB (Builds)
      await runDiv2(
        "DIV2_HUB_BUILDS",
        "Hub (Builds)",
        ["Type", "Name", "Author", "Updated", "Link"],
        async (rows, tx) => {
          let created = 0, updated = 0, errorsCount = 0;
          const existing = await tx.communityBuildGuide.findMany({ select: { id: true, sourceSheet: true, name: true, author: true, link: true } });
          const byKey = new Map<string, any>(
            existing.map((g: any) => [`${String(g.sourceSheet)}|${String(g.link ?? "").trim().toLowerCase()}|${String(g.name).trim().toLowerCase()}|${String(g.author ?? "").trim().toLowerCase()}`, g] as const),
          );

          let order = 0;
          for (const r of rows) {
            const type = String(r["type"] ?? "").trim() || null;
            const name = String(r["name"] ?? "").trim();
            const author = String(r["author"] ?? "").trim() || null;
            const updatedRaw = String(r["updated"] ?? "").trim() || null;
            const link = String(r["link"] ?? "").trim() || null;
            const outline = String(r["build_outline"] ?? "").trim() || null;
            if (isJunkText(name)) continue;

            try {
              const key = `Hub (Builds)|${String(link ?? "").trim().toLowerCase()}|${name.toLowerCase()}|${String(author ?? "").trim().toLowerCase()}`;
              const hit = byKey.get(key);
              if (hit) {
                await tx.communityBuildGuide.update({
                  where: { id: hit.id },
                  data: { type, name, author, updatedRaw, link, outline, order: order++ },
                });
                updated++;
              } else {
                const id = autoId("CBG_");
                const createdRow = await tx.communityBuildGuide.create({
                  data: { id, type, name, author, updatedRaw, link, outline, order: order++ },
                });
                byKey.set(key, createdRow);
                created++;
              }
            } catch (e: any) {
              errorsCount++;
              errors.push({ sheet: "Hub (Builds)", id: name, error: e?.message ?? String(e) });
            }
          }

          return { created, updated, errors: errorsCount };
        },
      );

      // FAQ
      await runDiv2(
        "DIV2_FAQ",
        "FAQ",
        ["Group", "Type", "Question", "Answer"],
        async (rows, tx) => {
          let created = 0, updated = 0, errorsCount = 0;
          // Reset FAQ on each import: it's mostly free text and ordering matters.
          await tx.communityFaq.deleteMany({ where: { sourceSheet: "FAQ" } });

          const data: any[] = [];
          let order = 0;
          for (const r of rows) {
            const group = String(r["group"] ?? "").trim() || null;
            const type = String(r["type"] ?? "").trim() || null;
            const question = String(r["question"] ?? "").trim();
            const answer = String(r["answer"] ?? "").trim() || null;
            const comments = String(r["comments"] ?? "").trim() || null;
            if (isJunkText(question)) continue;
            data.push({
              id: autoId("FAQ_"),
              group,
              type,
              question,
              answer,
              comments,
              order: order++,
              sourceSheet: "FAQ",
            });
          }

          try {
            if (data.length) await tx.communityFaq.createMany({ data });
            created = data.length;
          } catch (e: any) {
            errorsCount++;
            errors.push({ sheet: "FAQ", error: e?.message ?? String(e) });
          }

          return { created, updated, errors: errorsCount };
        },
      );

      // CREDITS
      await runDiv2(
        "DIV2_CREDITS",
        "Credits+admin",
        ["Name", "Job Description", "Contact Info"],
        async (rows, tx) => {
          let created = 0, updated = 0, errorsCount = 0;
          await tx.communityCredit.deleteMany({ where: { sourceSheet: "Credits+admin" } });

          const data: any[] = [];
          for (const r of rows) {
            const name = String(r["name"] ?? "").trim();
            if (isJunkText(name)) continue;
            const jobDescription = String(r["job_description"] ?? r["job_description_2"] ?? "").trim() || null;
            const contactInfo = String(r["contact_info"] ?? r["contact_info_2"] ?? "").trim() || null;
            data.push({
              id: autoId("CRD_"),
              name,
              jobDescription,
              contactInfo,
              notes: null,
              sourceSheet: "Credits+admin",
            });
          }

          try {
            if (data.length) await tx.communityCredit.createMany({ data });
            created = data.length;
          } catch (e: any) {
            errorsCount++;
            errors.push({ sheet: "Credits+admin", error: e?.message ?? String(e) });
          }

          return { created, updated, errors: errorsCount };
        },
      );

      // FULL SHEET DUMP (guarantees 100% of the workbook is persisted even when we don't have specific models yet)
      await (async () => {
        const reportKey = "DIV2_SHEET_DUMP";
        try {
          report[reportKey] = await this.prisma.$transaction(async (tx) => {
            let created = 0, updated = 0, errorsCount = 0;
            const sourceKey = "DIV2_GEAR_SPREADSHEET";

            for (const ws of workbook.worksheets) {
              const sheetName = ws.name;
              try {
                // columnCount can be 0 for some sheets; estimate from the first rows.
                let maxCols = ws.columnCount || 0;
                const scanRows = Math.min(ws.rowCount || 0, 50);
                for (let r = 1; r <= scanRows; r++) {
                  maxCols = Math.max(maxCols, ws.getRow(r).cellCount || 0);
                }
                if (!maxCols) maxCols = 1;

                const rowsData: any[] = [];
                for (let r = 1; r <= (ws.rowCount || 0); r++) {
                  const row = ws.getRow(r);
                  const cells: Record<string, string> = {};
                  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                    const t = safeCellText(cell);
                    if (!t || isJunkText(t)) return;
                    cells[String(colNumber)] = t;
                  });
                  if (!Object.keys(cells).length) continue;
                  rowsData.push({
                    sourceKey,
                    sheetName,
                    rowNumber: r,
                    data: { maxCols, cells },
                  });
                }

                await tx.spreadsheetDumpRow.deleteMany({ where: { sourceKey, sheetName } });
                if (rowsData.length) {
                  await tx.spreadsheetDumpRow.createMany({ data: rowsData });
                }
                created += rowsData.length;
              } catch (e: any) {
                errorsCount++;
                errors.push({ sheet: sheetName, error: e?.message ?? String(e) });
              }
            }

            return { created, updated, errors: errorsCount };
          });
        } catch (e: any) {
          errors.push({ sheet: "DIV2_SHEET_DUMP", error: e?.message ?? String(e) });
        }
      })();

      // WEAPONS (Named + Exotics)
      await runDiv2(
        "DIV2_WEAPONS_NAMED_EXOTICS",
        "Weapons Named + Exotics",
        ["Variant", "Name", "Drop Location"],
          async (rows, tx) => {
            let created = 0, updated = 0, errorsCount = 0;

          const existingWeapons = await tx.weapon.findMany({
            select: { id: true, name: true, class: true, rarity: true, rpm: true, magSize: true, baseDamage: true, notes: true },
          });
          const weaponByKey = new Map<string, any>(
            existingWeapons.map((w: any) => [`${String(w.class)}|${String(w.rarity)}|${String(w.name).trim().toLowerCase()}`, w] as const),
          );

          const talents = await tx.talent.findMany({ select: { id: true, name: true } });
          const talentByName = new Map<string, any>(talents.map((t: any) => [String(t.name).trim().toLowerCase(), t] as const));
          const talentNames = Array.from(talentByName.keys()).sort((a, b) => b.length - a.length);
          const matchTalentPrefix = (textRaw: string): any | null => {
            const text = String(textRaw ?? "").trim().toLowerCase();
            if (!text) return null;
            for (const n of talentNames) {
              if (text === n || text.startsWith(`${n} `)) return talentByName.get(n) ?? null;
            }
            return null;
          };

          for (const r of rows) {
            const typeLabel = String(r["col_1"] ?? "").trim(); // column with "Assault Rifle", etc.
            const weaponClass = parseWeaponClassFromType(typeLabel);
            const name = String(r["name"] ?? "").trim();
            if (!weaponClass || isJunkText(name)) continue;

            try {
              const variant = String(r["variant"] ?? "").trim();
              const drop = String(r["drop_location"] ?? "").trim();
              const flavor = String(r["flavour_text_notes"] ?? r["flavour_text_notes_2"] ?? r["flavour_text_notes_3"] ?? "").trim();
              const talentText = String(r["talent_or_unique_attribute_if_no_name_is_given"] ?? "").trim();
              const exoticMods = String(r["exotic_mods"] ?? "").trim();
              const isExotic = !isJunkText(exoticMods);
              const rarity = isExotic ? "Exotic" : "Named";

              const matched = matchTalentPrefix(talentText);
              const talentId = matched?.id ?? null;

              const base = variant ? weaponByKey.get(`${weaponClass}|HighEnd|${variant.toLowerCase()}`) : null;
              const baseDetailEntries = base?.notes ? parseExtendedDetailEntries(base.notes) : [];

              const notes = JSON.stringify({
                _kind: "td2_extended_item_details",
                description: flavor || undefined,
                acquisition: drop || undefined,
                detailEntries: baseDetailEntries,
              });

              const key = `${weaponClass}|${rarity}|${name.toLowerCase()}`;
              const hit = weaponByKey.get(key);
              if (hit) {
                await tx.weapon.update({
                  where: { id: hit.id },
                  data: {
                    name,
                    class: weaponClass,
                    rarity,
                    isNamed: !isExotic,
                    isExotic,
                    rpm: base?.rpm ?? null,
                    magSize: base?.magSize ?? null,
                    baseDamage: base?.baseDamage ?? null,
                    talentId: talentId ?? undefined,
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
                    rarity,
                    isNamed: !isExotic,
                    isExotic,
                    rpm: base?.rpm ?? null,
                    magSize: base?.magSize ?? null,
                    baseDamage: base?.baseDamage ?? null,
                    talentId: talentId ?? undefined,
                    notes,
                  },
                });
                weaponByKey.set(key, createdRow);
                created++;
              }
            } catch (e: any) {
              errorsCount++;
              errors.push({ sheet: "Weapons Named + Exotics", id: name, error: e?.message ?? String(e) });
            }
          }

          return { created, updated, errors: errorsCount };
        },
      );

      // GEAR (Named + Exotics)
      await runDiv2(
        "DIV2_GEAR_NAMED_EXOTICS",
        "Gear Named + Exotics",
        ["Type", "Brand", "Name", "Core attribute"],
        async (rows, tx) => {
          let created = 0, updated = 0, errorsCount = 0;

          const existingBrands = await tx.brand.findMany({ select: { id: true, name: true } });
          const brandByName = new Map<string, any>(
            existingBrands.map((b: any) => [String(b.name).trim().toLowerCase(), b] as const),
          );
          const ensureBrand = async (nameRaw: string): Promise<string | null> => {
            const name = String(nameRaw ?? "").trim();
            if (isJunkText(name)) return null;
            const key = name.toLowerCase();
            const hit = brandByName.get(key);
            if (hit) return hit.id;
            const id = autoId("BRD_");
            const createdRow = await tx.brand.create({ data: { id, name } });
            brandByName.set(key, createdRow);
            return id;
          };

          const talents = await tx.talent.findMany({ select: { id: true, name: true } });
          const talentByName = new Map<string, any>(talents.map((t: any) => [String(t.name).trim().toLowerCase(), t] as const));
          const ensureTalentByName = async (nameRaw: string, type: string): Promise<string | null> => {
            const name = String(nameRaw ?? "").trim();
            if (isJunkText(name)) return null;
            const key = name.toLowerCase();
            const hit = talentByName.get(key);
            if (hit) return hit.id;
            const id = autoId("TLT_");
            const createdRow = await tx.talent.create({ data: { id, name, type, description: null } });
            talentByName.set(key, createdRow);
            return id;
          };

          const existingItems = await tx.gearItem.findMany({ select: { id: true, name: true, slot: true, rarity: true } });
          const itemByKey = new Map<string, any>(
            existingItems.map((it: any) => [`${String(it.slot)}|${String(it.rarity)}|${String(it.name).trim().toLowerCase()}`, it] as const),
          );

          for (const r of rows) {
            const slotRaw = String(r["type"] ?? "").trim();
            const slot = slotRaw ? slotRaw[0].toUpperCase() + slotRaw.slice(1) : "";
            const name = String(r["name"] ?? "").trim();
            if (isJunkText(slot) || isJunkText(name)) continue;

            try {
              const brandName = String(r["brand"] ?? "").trim();
              const brandId = await ensureBrand(brandName);

              const coreCell = String(r["core_attribute"] ?? "").trim();
              const coreParsed = parseAttrNameValue(coreCell);
              const coreColor = coreColorFromAttrName(coreParsed.name);

              const minor1 = parseAttrNameValue(String(r["minor_1"] ?? "").trim());
              const minor2 = parseAttrNameValue(String(r["minor_2"] ?? "").trim());
              const minor3 = parseAttrNameValue(String(r["minor_3"] ?? "").trim());

              const modSlots =
                [minor1.name, minor2.name, minor3.name].filter((x) => String(x).toLowerCase().includes("mod slot")).length || null;

              const perkDesc = String(r["talent_named_perk_description"] ?? "").trim();
              const flavor = String(r["flavour_text_notes"] ?? r["flavour_text_notes_2"] ?? r["flavour_text_notes_3"] ?? "").trim();
              const talentName = String(r["talent"] ?? "").trim();
              const talentType = slot === "Backpack" ? "Backpack" : slot === "Chest" ? "Chest" : "GearSet";
              const talentId = await ensureTalentByName(talentName, talentType);

              const isExotic = !brandId; // heuristic: exotics usually aren't tied to brands
              const rarity = isExotic ? "Exotic" : "Named";

              const detailEntries: any[] = [];
              const push = (group: string, key: string, value: string) => {
                const v = String(value ?? "").trim();
                if (isJunkText(v)) return;
                detailEntries.push({ group, key, value: v });
              };

              push("classification", "ItemType", "Gear");
              push("gear_core", "CoreAttribute", coreParsed.name);
              push("gear_core", "CoreValue", coreParsed.value ?? "");

              const minorPairs = [minor1, minor2, minor3].filter((m) => m.name && !m.name.toLowerCase().includes("mod slot")).slice(0, 2);
              push("gear_attrs", "Attr1Name", minorPairs[0]?.name ?? "");
              push("gear_attrs", "Attr1Value", minorPairs[0]?.value ?? "");
              push("gear_attrs", "Attr2Name", minorPairs[1]?.name ?? "");
              push("gear_attrs", "Attr2Value", minorPairs[1]?.value ?? "");

              if (!isJunkText(perkDesc)) push("general", "NamedPerk", perkDesc);

              const notes = JSON.stringify({
                _kind: "td2_extended_item_details",
                description: (flavor || perkDesc) || undefined,
                acquisition: String(r["source"] ?? "").trim() || undefined,
                detailEntries,
              });

              const key = `${slot}|${rarity}|${name.toLowerCase()}`;
              const hit = itemByKey.get(key);

              const statsData: any[] = [];
              if (coreParsed.name) statsData.push({ kind: "CORE", name: coreParsed.name, value: coreParsed.value, order: 1 });
              const minors = [minor1, minor2, minor3].filter((m) => m.name && !m.name.toLowerCase().includes("mod slot"));
              minors.forEach((m, i) => statsData.push({ kind: "MINOR", name: m.name, value: m.value, order: 10 + i }));

              if (hit) {
                await tx.gearItem.update({
                  where: { id: hit.id },
                  data: {
                    name,
                    slot,
                    rarity,
                    isNamed: !isExotic,
                    isExotic,
                    brandId: brandId ?? null,
                    coreColor,
                    coreCount: 1,
                    modSlots,
                    talentId: talentId ?? null,
                    notes,
                    stats: {
                      deleteMany: {},
                      createMany: { data: statsData },
                    },
                  },
                });
                updated++;
              } else {
                const id = autoId("ITG_");
                const createdRow = await tx.gearItem.create({
                  data: {
                    id,
                    name,
                    slot,
                    rarity,
                    isNamed: !isExotic,
                    isExotic,
                    brandId: brandId ?? undefined,
                    coreColor,
                    coreCount: 1,
                    modSlots,
                    talentId: talentId ?? undefined,
                    notes,
                    stats: statsData.length ? { createMany: { data: statsData } } : undefined,
                  },
                });
                itemByKey.set(key, createdRow);
                created++;
              }
            } catch (e: any) {
              errorsCount++;
              errors.push({ sheet: "Gear Named + Exotics", id: name, error: e?.message ?? String(e) });
            }
          }

          return { created, updated, errors: errorsCount };
        },
      );
    }

    processedSteps = totalSteps;
    await emitProgress();
    return { ok: errors.length === 0, report, errors };
  }
}
