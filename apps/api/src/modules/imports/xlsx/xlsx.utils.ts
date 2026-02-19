import * as ExcelJS from "exceljs";

export type UpsertReport = { created: number; updated: number; errors: number };

export function unwrapCellValue(v: any): any {
  // exceljs may wrap formula output as { result: ... }
  return (v as any)?.result ?? v;
}

export function safeCellText(cell: ExcelJS.Cell | undefined | null): string {
  // exceljs's cell.text can throw for merged cells with null values.
  try {
    const t = (cell as any)?.text;
    if (typeof t === "string") return t.replace(/\s+/g, " ").trim();
  } catch {
    // ignore
  }

  const v: any = (cell as any)?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    // Hyperlink/rich objects often look like { text, hyperlink }.
    if (typeof v?.text === "string") return String(v.text).replace(/\s+/g, " ").trim();
    if (Array.isArray(v.richText)) {
      return v.richText.map((x: any) => String(x?.text ?? "")).join("").replace(/\s+/g, " ").trim();
    }
    // Formula objects may be { formula, result } or { sharedFormula, result }.
    if (v?.result !== undefined && v?.result !== null) return String(v.result).replace(/\s+/g, " ").trim();
    if (typeof v?.formula === "string" || typeof v?.sharedFormula === "string") return "";
  }
  return String(v).replace(/\s+/g, " ").trim();
}

export function normalizeHeaderKey(v: any): string {
  const raw = String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return raw.replace(/[\s-]+/g, "_");
}

export function asString(v: any): string | undefined {
  const unwrapped = unwrapCellValue(v);
  if (unwrapped === null || unwrapped === undefined) return undefined;
  const s = String(unwrapped).trim();
  return s.length ? s : undefined;
}

export function asBool(v: any): boolean | undefined {
  const unwrapped = unwrapCellValue(v);
  if (unwrapped === null || unwrapped === undefined) return undefined;
  if (typeof unwrapped === "boolean") return unwrapped;
  const s = String(unwrapped).trim().toLowerCase();
  if (["true", "t", "yes", "y", "1", "sim", "s"].includes(s)) return true;
  if (["false", "f", "no", "n", "0", "nao"].includes(s)) return false;
  return undefined;
}

export function asInt(v: any): number | undefined {
  const unwrapped = unwrapCellValue(v);
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return undefined;
  if (typeof unwrapped === "number") {
    return Number.isInteger(unwrapped) ? unwrapped : undefined;
  }
  const s = String(unwrapped).trim();
  if (!/^-?\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : undefined;
}

function excelSerialDateToDate(serial: number): Date {
  // Excel epoch baseline (with Lotus 1900 leap year compatibility): 1899-12-30
  const excelEpochUtcMs = Date.UTC(1899, 11, 30);
  const utcMs = excelEpochUtcMs + serial * 24 * 60 * 60 * 1000;
  return new Date(utcMs);
}

function parseBrDateString(s: string): Date | undefined {
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\sT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return undefined;
  const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = match;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function asDate(v: any): Date | undefined {
  const unwrapped = unwrapCellValue(v);
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return undefined;
  if (unwrapped instanceof Date) return unwrapped;
  if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) {
    return excelSerialDateToDate(unwrapped);
  }

  const s = String(unwrapped).trim();
  const brDate = parseBrDateString(s);
  if (brDate) return brDate;

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function readSheetRows(ws: ExcelJS.Worksheet): Array<Record<string, any>> {
  // Header row is row 1
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeaderKey(cell.value);
  });

  const rows: Array<Record<string, any>> = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, any> = {};
    let hasAny = false;
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const value = unwrapCellValue(cell.value);
      if (value !== null && value !== undefined && value !== "") hasAny = true;
      obj[key] = value;
    });
    if (hasAny) rows.push(obj);
  });
  return rows;
}

export function pickValue(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (row[k] !== undefined) return row[k];
  }
  return undefined;
}

export function findHeaderRowByTokens(ws: ExcelJS.Worksheet, tokens: string[], maxScanRows = 30): number | null {
  const want = tokens.map((t) => normalizeHeaderKey(t));
  const limit = Math.min(maxScanRows, ws.rowCount || maxScanRows);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const seen = new Set<string>();
    row.eachCell((cell) => {
      const k = normalizeHeaderKey(safeCellText(cell));
      if (k) seen.add(k);
    });
    if (want.every((t) => seen.has(t))) return r;
  }
  return null;
}

export function readSheetRowsText(ws: ExcelJS.Worksheet, headerRowNumber: number): Array<Record<string, string>> {
  const headerRow = ws.getRow(headerRowNumber);
  const headers: string[] = [];
  const used = new Set<string>();

  const maxCols = Math.max(ws.columnCount || 0, headerRow.cellCount || 0, 1);
  for (let colNumber = 1; colNumber <= maxCols; colNumber++) {
    const raw = safeCellText(headerRow.getCell(colNumber));
    const base = normalizeHeaderKey(raw) || `col_${colNumber}`;
    let key = base;
    let i = 2;
    while (used.has(key)) key = `${base}_${i++}`;
    used.add(key);
    headers[colNumber] = key;
  }

  const rows: Array<Record<string, string>> = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const obj: Record<string, string> = {};
    let hasAny = false;
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const text = safeCellText(cell);
      if (text) hasAny = true;
      obj[key] = text;
    });
    if (hasAny) rows.push(obj);
  });
  return rows;
}

export function parseWeaponClassFromGroup(group: string): string | undefined {
  const g = String(group ?? "").trim().toUpperCase();
  if (!g) return undefined;
  if (g.includes("ASSAULT RIFLES")) return "AR";
  if (g.includes("SUBMACHINE")) return "SMG";
  if (g.includes("LIGHT MACHINE")) return "LMG";
  if (g === "RIFLES" || g.includes(" RIFLES")) return g.includes("MARKSMAN") ? "MMR" : "Rifle";
  if (g.includes("MARKSMAN")) return "MMR";
  if (g.includes("SHOTGUN")) return "Shotgun";
  if (g.includes("PISTOL")) return "Pistol";
  return undefined;
}

export function parseWeaponClassFromType(typeRaw: string): string | undefined {
  const t = String(typeRaw ?? "").trim().toLowerCase();
  if (!t) return undefined;
  if (t.includes("assault")) return "AR";
  if (t.includes("submachine")) return "SMG";
  if (t.includes("light machine")) return "LMG";
  if (t.includes("marksman")) return "MMR";
  if (t === "rifle" || t.includes("rifle")) return "Rifle";
  if (t.includes("shotgun")) return "Shotgun";
  if (t.includes("pistol")) return "Pistol";
  return undefined;
}

export function isJunkText(v: string | undefined): boolean {
  const s = String(v ?? "").trim();
  if (!s) return true;
  if (s.toLowerCase() === "[object object]") return true;
  if (s === "----" || s === "---") return true;
  return false;
}

export function stripLeadSymbol(s: string): string {
  return String(s ?? "").replace(/^[▶\u25B6]\s*/g, "").trim();
}

export function coreColorFromAttrName(nameRaw: string): string | null {
  const n = String(nameRaw ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("weapon")) return "Red";
  if (n.includes("armour") || n.includes("armor")) return "Blue";
  if (n.includes("skill")) return "Yellow";
  return null;
}

function normKey(v: any): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function normalizeGearSlot(raw: any): "Mask" | "Chest" | "Backpack" | "Gloves" | "Holster" | "Kneepads" {
  const k = normKey(raw);
  if (!k) return "Mask";
  if (["mask", "mascara", "mascaras"].includes(k)) return "Mask";
  if (["chest", "vest", "colete"].includes(k)) return "Chest";
  if (["backpack", "mochila"].includes(k)) return "Backpack";
  if (["gloves", "luva", "luvas"].includes(k)) return "Gloves";
  if (["holster", "coldre"].includes(k)) return "Holster";
  if (["kneepads", "kneepad", "knees", "knee", "joelheira", "joelheiras"].includes(k)) return "Kneepads";
  // If it is already correct-cased, keep it.
  const s = String(raw ?? "").trim();
  if (s === "Mask" || s === "Chest" || s === "Backpack" || s === "Gloves" || s === "Holster" || s === "Kneepads") return s;
  return "Mask";
}

export function normalizeGearRarity(raw: any): "HighEnd" | "Named" | "Exotic" | "GearSet" {
  const k = normKey(raw);
  if (!k) return "HighEnd";
  if (k === "named") return "Named";
  if (k === "exotic") return "Exotic";
  if (k === "gearset") return "GearSet";
  if (k === "highend") return "HighEnd";
  const s = String(raw ?? "").trim();
  if (s === "HighEnd" || s === "Named" || s === "Exotic" || s === "GearSet") return s;
  return "HighEnd";
}

export function normalizeWeaponRarity(raw: any): "HighEnd" | "Named" | "Exotic" {
  const r = normalizeGearRarity(raw);
  return r === "GearSet" ? "HighEnd" : r;
}

export function normalizeCoreColor(raw: any): "Red" | "Blue" | "Yellow" | null {
  const k = normKey(raw);
  if (!k) return null;
  if (k === "red") return "Red";
  if (k === "blue") return "Blue";
  if (k === "yellow") return "Yellow";
  const s = String(raw ?? "").trim();
  if (s === "Red" || s === "Blue" || s === "Yellow") return s;
  return null;
}

export function normalizeTalentType(raw: any): "Weapon" | "Chest" | "Backpack" | "GearSet" {
  const k = normKey(raw);
  if (!k) return "Weapon";
  if (k === "weapon") return "Weapon";
  if (k === "chest") return "Chest";
  if (k === "backpack") return "Backpack";
  if (k === "gearset") return "GearSet";
  const s = String(raw ?? "").trim();
  if (s === "Weapon" || s === "Chest" || s === "Backpack" || s === "GearSet") return s;
  return "Weapon";
}

export function normalizeWeaponClass(raw: any): "AR" | "SMG" | "LMG" | "Rifle" | "MMR" | "Shotgun" | "Pistol" {
  const k = normKey(raw);
  if (!k) return "AR";
  if (k === "ar" || k.includes("assaultrifle")) return "AR";
  if (k === "smg" || k.includes("submachine")) return "SMG";
  if (k === "lmg" || k.includes("lightmachine")) return "LMG";
  if (k === "mmr" || k.includes("marksman")) return "MMR";
  if (k === "rifle" || k.includes("rifle")) return "Rifle";
  if (k.includes("shotgun")) return "Shotgun";
  if (k.includes("pistol")) return "Pistol";
  const s = String(raw ?? "").trim();
  if (s === "AR" || s === "SMG" || s === "LMG" || s === "Rifle" || s === "MMR" || s === "Shotgun" || s === "Pistol") return s;
  return "AR";
}

export function normalizeAttributeCategory(raw: any): "Offensive" | "Defensive" | "Utility" {
  const k = normKey(raw);
  if (!k) return "Offensive";
  if (k === "offensive") return "Offensive";
  if (k === "defensive") return "Defensive";
  if (k === "utility") return "Utility";
  const s = String(raw ?? "").trim();
  if (s === "Offensive" || s === "Defensive" || s === "Utility") return s;
  return "Offensive";
}

export function normalizeAttributeUnit(raw: any): "PERCENT" | "FLAT" {
  const k = normKey(raw);
  if (!k) return "PERCENT";
  if (k === "%" || k === "percent" || k === "percentage" || k === "pct" || k === "porcentagem") return "PERCENT";
  if (k === "flat") return "FLAT";
  const s = String(raw ?? "").trim();
  if (s === "PERCENT" || s === "FLAT") return s;
  return "PERCENT";
}

export function parseAttrNameValue(raw: string): { name: string; value: string | null } {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s || isJunkText(s)) return { name: "", value: null };

  const dashIdx = s.indexOf(" - ");
  if (dashIdx >= 0) {
    const left = s.slice(0, dashIdx).trim();
    const right = s.slice(dashIdx + 3).trim();
    const name = left.replace(/[0-9.,]+%?$/g, "").trim();
    return { name: name || left, value: right || null };
  }

  const lead = s.match(/^([0-9.,]+%?)\s+(.+)$/);
  if (lead) {
    const value = lead[1].trim();
    const name = lead[2].trim();
    if (value && name) return { name, value };
  }

  const tail = s.match(/^(.+?)\s+([0-9.,]+%?)$/);
  if (tail) {
    const name = tail[1].trim();
    const value = tail[2].trim();
    return { name, value: value || null };
  }

  return { name: s, value: null };
}

export function parseExtendedDetailEntries(notes?: string | null): any[] {
  const s = String(notes ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object" && parsed._kind === "td2_extended_item_details") {
      return Array.isArray((parsed as any).detailEntries) ? (parsed as any).detailEntries : [];
    }
  } catch {
    // ignore
  }
  return [];
}

export function findKeyByPrefixes(obj: Record<string, any>, prefixes: string[]): string | null {
  const keys = Object.keys(obj || {});
  for (const p of prefixes) {
    const hit = keys.find((k) => String(k).toLowerCase().startsWith(String(p).toLowerCase()));
    if (hit) return hit;
  }
  return null;
}
