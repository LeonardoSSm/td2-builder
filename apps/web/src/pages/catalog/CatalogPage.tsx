import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "../../api/http";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import ItemPreviewCard from "../admin-items/components/ItemPreviewCard";
import { useAuth } from "../../auth/auth";
import ComboBox from "../../components/ComboBox";

type GearItem = {
  id: string;
  name: string;
  slot: string;
  rarity: string;
  coreColor?: string | null;
  notes?: string | null;
  brand?: { id: string; name: string; bonus1?: string | null; bonus2?: string | null; bonus3?: string | null } | null;
  gearSet?: { id: string; name: string; description?: string | null; bonus2?: string | null; bonus3?: string | null; bonus4?: string | null } | null;
  talent?: { id: string; name: string } | null;
};

type GearSet = {
  id: string;
  name: string;
  description?: string | null;
  bonus2?: string | null;
  bonus3?: string | null;
  bonus4?: string | null;
  wikiUrl?: string | null;
  logoUrl?: string | null;
};

type Weapon = {
  id: string;
  name: string;
  class: string;
  rarity: string;
  baseDamage?: string | null;
  rpm?: number | null;
  magSize?: number | null;
  talent?: { id: string; name: string } | null;
  notes?: string | null;
};

type DetailEntry = {
  group?: string | null;
  key: string;
  value: string;
  unit?: string | null;
  minValue?: string | null;
  maxValue?: string | null;
  notes?: string | null;
  order?: number | null;
};

type GearItemDetail = GearItem & {
  imageUrl?: string | null;
  wikiUrl?: string | null;
  targetLootRef?: string | null;
  patchVersion?: string | null;
  lastUpdated?: string | null;
  detailModel?: {
    description?: string | null;
    acquisition?: string | null;
    expertiseCategory?: string | null;
    itemLevel?: string | null;
    detailEntries?: DetailEntry[];
  } | null;
  rules?: Array<{
    isCore?: boolean;
    isMinor?: boolean;
    minValue?: string | null;
    maxValue?: string | null;
    notes?: string | null;
    attribute?: {
      name: string;
      category?: string | null;
      unit?: string | null;
    } | null;
  }>;
  stats?: Array<{ kind: string; name: string; value?: string | null; order?: number | null }>;
  mods?: Array<{ name: string; value?: string | null; order?: number | null }>;
};

type WeaponDetail = Weapon & {
  imageUrl?: string | null;
  wikiUrl?: string | null;
  targetLootRef?: string | null;
  patchVersion?: string | null;
  lastUpdated?: string | null;
  detailModel?: {
    description?: string | null;
    acquisition?: string | null;
    expertiseCategory?: string | null;
    itemLevel?: string | null;
    detailEntries?: DetailEntry[];
  } | null;
};

function readDetailValue(model: any, group: string, key: string): string {
  const entries: DetailEntry[] = Array.isArray(model?.detailEntries) ? model.detailEntries : [];
  const v = entries.find((e) => String(e?.group ?? "") === group && String(e?.key ?? "") === key)?.value;
  return String(v ?? "").trim();
}

function prettifyToken(s: string): string {
  return String(s ?? "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

function groupLabel(tx: (pt: string, en: string) => string, groupRaw: string): string {
  const g = String(groupRaw ?? "").trim();
  const k = g.toLowerCase();
  if (k === "classification") return tx("Classificação", "Classification");
  if (k === "gear_header") return tx("Cabeçalho do Item", "Item Header");
  if (k === "gear_proficiency") return tx("Proficiência", "Proficiency");
  if (k === "gear_core") return tx("Atributo Central", "Core Attribute");
  if (k === "gear_attrs") return tx("Atributos", "Attributes");
  if (k === "gear_mods") return tx("Mods", "Mods");
  if (k === "weapon_stats") return tx("Status da Arma", "Weapon Stats");
  if (k === "weapon_config") return tx("Configuração", "Configuration");
  if (k === "weapon_mods") return tx("Mods da Arma", "Weapon Mods");
  if (k === "general") return tx("Geral", "General");
  return prettifyToken(g).toUpperCase();
}

function entryLabel(tx: (pt: string, en: string) => string, groupRaw: string, keyRaw: string): string {
  const g = String(groupRaw ?? "").toLowerCase();
  const k = String(keyRaw ?? "");
  if (g === "classification") {
    if (k === "ItemType") return tx("Tipo", "Type");
    if (k === "AttributeCategory") return tx("Categoria de Atributo", "Attribute Category");
    if (k === "TalentType") return tx("Tipo de Talento", "Talent Type");
  }
  if (g === "gear_header") {
    if (k === "ArmorValue") return tx("Proteção", "Armor");
  }
  if (g === "gear_proficiency") {
    if (k === "ProficiencyRank") return tx("Rank", "Rank");
    if (k === "ProficiencyProgress") return tx("Progresso", "Progress");
    if (k === "ProficiencyMax") return tx("Máx", "Max");
  }
  if (g === "gear_core") {
    if (k === "CoreAttribute") return tx("Atributo", "Attribute");
    if (k === "CoreValue") return tx("Valor", "Value");
  }
  if (g === "weapon_stats") {
    if (k === "TotalDamage") return tx("Dano total", "Total damage");
    if (k === "OptimalRange") return tx("Alcance ideal", "Optimal range");
    if (k === "HeadshotDamagePct") return tx("% dano tiro na cabeça", "Headshot damage %");
  }
  if (g === "weapon_config") {
    if (k === "Pericia") return tx("Perícia", "Expertise");
    if (k === "AtributoCentral") return tx("Atributo central", "Core attribute");
    if (k === "Atributo") return tx("Atributo", "Attribute");
  }
  if (g === "weapon_mods") {
    if (k === "Mod_Pente") return tx("Pente", "Magazine");
    if (k === "Mod_Mira") return tx("Mira", "Scope");
    if (k === "Mod_Bocal") return tx("Bocal", "Muzzle");
    if (k === "Mod_SuporteInferior") return tx("Suporte inferior", "Underbarrel");
  }
  return prettifyToken(k);
}

const GEAR_SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;
const RARITIES = ["HighEnd", "Named", "Exotic", "GearSet"] as const;
const WEAPON_CLASSES = ["AR", "SMG", "LMG", "Rifle", "MMR", "Shotgun", "Pistol"] as const;
const CORE_COLORS = ["Red", "Blue", "Yellow"] as const;

function rarityRowClass(rarityRaw: string): string {
  const r = String(rarityRaw ?? "").trim();
  if (r === "Exotic") return "td2-rarity--exotic";
  if (r === "GearSet") return "td2-rarity--gearset";
  if (r === "Named") return "td2-rarity--named";
  if (r === "HighEnd") return "td2-rarity--highend";
  return "";
}

function parseDetailEntriesJson(raw: string): DetailEntry[] | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const parsed = JSON.parse(s);
  if (!Array.isArray(parsed)) throw new Error("detailEntries must be a JSON array.");
  // Minimal shape validation.
  return parsed
    .filter((x) => x && typeof x === "object" && typeof (x as any).key === "string" && typeof (x as any).value === "string")
    .map((x) => ({
      group: (x as any).group ?? undefined,
      key: String((x as any).key),
      value: String((x as any).value),
      unit: (x as any).unit ?? undefined,
      minValue: (x as any).minValue ?? undefined,
      maxValue: (x as any).maxValue ?? undefined,
      notes: (x as any).notes ?? undefined,
      order: (x as any).order ?? undefined,
    }));
}

export default function CatalogPage() {
  const { tx } = useI18n();
  const { me, hasPerm } = useAuth();
  const qc = useQueryClient();
  const canEdit = Boolean(me) && hasPerm("admin.items.manage");
  const [tab, setTab] = useState<"gear" | "weapon">("gear");
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState("");
  const [weaponClass, setWeaponClass] = useState("");
  const [rarity, setRarity] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<"" | "owned" | "missing">("");
  const PAGE_SIZE = 50;
  const [pageGear, setPageGear] = useState(0);
  const [pageWeapon, setPageWeapon] = useState(0);
  const [selected, setSelected] = useState<{ type: "gear" | "weapon"; id: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ type: "gear" | "weapon"; id: string } | null>(null);
  const [editHydrated, setEditHydrated] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRarity, setEditRarity] = useState("HighEnd");
  const [editSlot, setEditSlot] = useState("Mask");
  const [editWeaponClass, setEditWeaponClass] = useState("AR");
  const [editBrandId, setEditBrandId] = useState("");
  const [editSetId, setEditSetId] = useState("");
  const [editSetName, setEditSetName] = useState("");
  const [editCoreColor, setEditCoreColor] = useState("");
  const [editCoreCount, setEditCoreCount] = useState("");
  const [editModSlots, setEditModSlots] = useState("");
  const [editTalentId, setEditTalentId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAcquisition, setEditAcquisition] = useState("");
  const [editBaseDamage, setEditBaseDamage] = useState("");
  const [editRpm, setEditRpm] = useState("");
  const [editMagSize, setEditMagSize] = useState("");
  const [editDetailEntriesJson, setEditDetailEntriesJson] = useState("");
  const [editWikiUrl, setEditWikiUrl] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editTargetLootRef, setEditTargetLootRef] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [createSetOpen, setCreateSetOpen] = useState(false);
  const [createSetName, setCreateSetName] = useState("");
  const [createSetDescription, setCreateSetDescription] = useState("");
  const [createSetBonus2, setCreateSetBonus2] = useState("");
  const [createSetBonus3, setCreateSetBonus3] = useState("");
  const [createSetBonus4, setCreateSetBonus4] = useState("");
  const [createSetWikiUrl, setCreateSetWikiUrl] = useState("");
  const [createSetLogoUrl, setCreateSetLogoUrl] = useState("");
  const [createSetErr, setCreateSetErr] = useState<string | null>(null);
  const [createSetBusy, setCreateSetBusy] = useState(false);

  const ACQUIRED_KEY = "td2.acquiredItems.v1";
  const [acquired, setAcquired] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACQUIRED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setAcquired(parsed);
    } catch {
      // ignore
    }
  }, []);
  const setAcquiredFor = (itemId: string, value: boolean) => {
    const id = String(itemId ?? "").trim();
    if (!id) return;
    setAcquired((cur) => {
      const next = { ...(cur ?? {}) };
      if (value) next[id] = true;
      else delete next[id];
      try {
        localStorage.setItem(ACQUIRED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    const value = String(text ?? "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
      window.setTimeout(() => setCopiedId((cur) => (cur === value ? null : cur)), 1200);
    } catch {
      // Fallback for insecure contexts.
      window.prompt(tx("Copie o ID:", "Copy the ID:"), value);
    }
  };

  // Reset pagination whenever filters change.
  useEffect(() => {
    setPageGear(0);
  }, [q, slot, rarity, ownedFilter, tab]);
  useEffect(() => {
    setPageWeapon(0);
  }, [q, weaponClass, rarity, ownedFilter, tab]);

  // Weapon catalog does not support GearSet rarity.
  useEffect(() => {
    if (tab === "weapon" && rarity === "GearSet") setRarity("");
  }, [tab, rarity]);

  const gearQs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (slot) p.set("slot", slot);
    if (rarity) p.set("rarity", rarity);
    p.set("take", String(PAGE_SIZE));
    p.set("skip", String(pageGear * PAGE_SIZE));
    return `?${p.toString()}`;
  }, [q, slot, rarity, PAGE_SIZE, pageGear]);

  const weaponQs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (weaponClass) p.set("class", weaponClass);
    if (rarity) p.set("rarity", rarity);
    p.set("take", String(PAGE_SIZE));
    p.set("skip", String(pageWeapon * PAGE_SIZE));
    return `?${p.toString()}`;
  }, [q, weaponClass, rarity, PAGE_SIZE, pageWeapon]);

  const gear = useQuery({
    queryKey: ["gear-items", gearQs],
    queryFn: () => apiGet<{ total: number; items: GearItem[] }>(`/catalog/gear-items${gearQs}`),
    enabled: tab === "gear",
  });

  const weapons = useQuery({
    queryKey: ["weapons", weaponQs],
    queryFn: () => apiGet<{ total: number; items: Weapon[] }>(`/catalog/weapons${weaponQs}`),
    enabled: tab === "weapon",
  });

  const gearSets = useQuery({
    queryKey: ["catalog-gear-sets"],
    queryFn: () => apiGet<GearSet[]>("/catalog/gear-sets"),
  });

  const gearSetOptions = useMemo(() => {
    const list = Array.isArray(gearSets.data) ? gearSets.data : [];
    return list.map((s) => ({ id: s.id, label: s.name, keywords: `${s.id} ${s.description ?? ""}`.trim() }));
  }, [gearSets.data]);

  const resolveGearSetByName = (nameRaw: string): GearSet | null => {
    const name = String(nameRaw ?? "").trim().toLowerCase();
    if (!name) return null;
    const list = Array.isArray(gearSets.data) ? gearSets.data : [];
    return list.find((s) => String(s.name ?? "").trim().toLowerCase() === name) ?? null;
  };

  const selectedDetail = useQuery<GearItemDetail | WeaponDetail>({
    queryKey: ["catalog-item-detail", selected?.type, selected?.id],
    queryFn: async () => {
      if (!selected?.id) throw new Error("No selection");
      if (selected.type === "weapon") return await apiGet<WeaponDetail>(`/catalog/weapons/${selected.id}`);
      return await apiGet<GearItemDetail>(`/catalog/gear-items/${selected.id}`);
    },
    enabled: Boolean(selected?.id),
  });

  const groupedDetails = useMemo(() => {
    const entries = (selectedDetail.data as any)?.detailModel?.detailEntries ?? [];
    const groups: Record<string, DetailEntry[]> = {};
    for (const e of entries) {
      const key = (e.group || "General").trim() || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return groups;
  }, [selectedDetail.data]);

  const selectedHeader = useMemo(() => {
    const d: any = selectedDetail.data as any;
    if (!d) return null;
    const t = selected?.type ?? (d?.class ? "weapon" : "gear");
    const kicker =
      t === "weapon"
        ? `${String(d?.class ?? "")} · ${String(d?.rarity ?? "")}`.trim()
        : `${String(d?.slot ?? "")} · ${String(d?.rarity ?? "")}`.trim();
    return {
      type: t,
      kicker: kicker || tx("Detalhes do Item", "Item Details"),
      name: String(d?.name ?? ""),
      id: String(d?.id ?? ""),
    };
  }, [selectedDetail.data, selected?.type, tx]);

  const selectedAcquired = selected?.id ? Boolean(acquired[selected.id]) : false;

  const editDetail = useQuery<GearItemDetail | WeaponDetail>({
    queryKey: ["catalog-item-edit-detail", editTarget?.type, editTarget?.id],
    queryFn: async () => {
      if (!editTarget?.id) throw new Error("No selection");
      if (editTarget.type === "weapon") return await apiGet<WeaponDetail>(`/catalog/weapons/${editTarget.id}`);
      return await apiGet<GearItemDetail>(`/catalog/gear-items/${editTarget.id}`);
    },
    enabled: Boolean(editTarget?.id),
  });

  useEffect(() => {
    if (!editTarget) return;
    if (!editDetail.data) return;
    if (editHydrated) return;
    const d: any = editDetail.data as any;
    const dm = d?.detailModel ?? null;

    setEditErr(null);
    setEditName(String(d?.name ?? ""));
    setEditRarity(String(d?.rarity ?? "HighEnd"));
    if (editTarget.type === "weapon") {
      setEditWeaponClass(String(d?.class ?? "AR"));
      setEditBaseDamage(String(d?.baseDamage ?? ""));
      setEditRpm(d?.rpm !== null && d?.rpm !== undefined ? String(d.rpm) : "");
      setEditMagSize(d?.magSize !== null && d?.magSize !== undefined ? String(d.magSize) : "");
    } else {
      setEditSlot(String(d?.slot ?? "Mask"));
      setEditBrandId(String(d?.brand?.id ?? d?.brandId ?? ""));
      setEditSetId(String(d?.gearSet?.id ?? d?.setId ?? ""));
      setEditSetName(String(d?.gearSet?.name ?? ""));
      setEditCoreColor(String(d?.coreColor ?? ""));
      setEditCoreCount(d?.coreCount !== null && d?.coreCount !== undefined ? String(d.coreCount) : "");
      setEditModSlots(d?.modSlots !== null && d?.modSlots !== undefined ? String(d.modSlots) : "");
    }

    setEditTalentId(String(d?.talent?.id ?? d?.talentId ?? ""));
    setEditDescription(String(dm?.description ?? ""));
    setEditAcquisition(String(dm?.acquisition ?? ""));
    setEditWikiUrl(String(d?.wikiUrl ?? ""));
    setEditImageUrl(String(d?.imageUrl ?? ""));
    setEditTargetLootRef(String(d?.targetLootRef ?? ""));
    setEditNotes(String(d?.notes ?? ""));

    const entries = Array.isArray(dm?.detailEntries) ? dm.detailEntries : [];
    setEditDetailEntriesJson(entries.length ? JSON.stringify(entries, null, 2) : "");

    setEditHydrated(true);
  }, [editDetail.data, editTarget, editHydrated]);

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      setEditErr(null);
      const d: any = editDetail.data as any;
      if (!d) throw new Error(tx("Carregue o item antes de salvar.", "Load the item before saving."));

      const payload: any = {};
      const nName = editName.trim();
      if (nName && nName !== String(d?.name ?? "")) payload.name = nName;

      const nRarity = String(editRarity ?? "").trim();
      if (nRarity && nRarity !== String(d?.rarity ?? "")) payload.rarity = nRarity;

      if (editTarget.type === "gear") {
        const nSlot = String(editSlot ?? "").trim();
        if (nSlot && nSlot !== String(d?.slot ?? "")) payload.slot = nSlot;

        const nBrand = editBrandId.trim();
        const nSet = editSetId.trim();
        if (nBrand !== String(d?.brand?.id ?? d?.brandId ?? "")) payload.brandId = nBrand || undefined;

        // Defensive: if user typed a gear set name but didn't pick/create one, don't allow a silent removal.
        if (editSetName.trim() && !nSet) {
          throw new Error(
            tx(
              "Gear Set não encontrado. Selecione um existente ou crie um novo (Enter).",
              "Gear set not found. Pick an existing one or create a new one (Enter).",
            ),
          );
        }

        if (nSet !== String(d?.gearSet?.id ?? d?.setId ?? "")) payload.setId = nSet || undefined;

        const nCoreColor = String(editCoreColor ?? "").trim();
        if (nCoreColor && nCoreColor !== String(d?.coreColor ?? "")) payload.coreColor = nCoreColor;

        if (editCoreCount.trim()) {
          const v = Number(editCoreCount);
          if (!Number.isFinite(v) || v < 0) throw new Error("coreCount must be a number >= 0");
          if (String(v) !== String(d?.coreCount ?? "")) payload.coreCount = Math.trunc(v);
        }

        if (editModSlots.trim()) {
          const v = Number(editModSlots);
          if (!Number.isFinite(v) || v < 0) throw new Error("modSlots must be a number >= 0");
          if (String(v) !== String(d?.modSlots ?? "")) payload.modSlots = Math.trunc(v);
        }
      } else {
        const nClass = String(editWeaponClass ?? "").trim();
        if (nClass && nClass !== String(d?.class ?? "")) payload.class = nClass;

        const nBase = editBaseDamage.trim();
        if (nBase !== String(d?.baseDamage ?? "")) payload.baseDamage = nBase || undefined;

        if (editRpm.trim()) {
          const v = Number(editRpm);
          if (!Number.isFinite(v) || v < 0) throw new Error("rpm must be a number >= 0");
          if (String(v) !== String(d?.rpm ?? "")) payload.rpm = Math.trunc(v);
        }

        if (editMagSize.trim()) {
          const v = Number(editMagSize);
          if (!Number.isFinite(v) || v < 0) throw new Error("magSize must be a number >= 0");
          if (String(v) !== String(d?.magSize ?? "")) payload.magSize = Math.trunc(v);
        }
      }

      const nTalent = editTalentId.trim();
      if (nTalent !== String(d?.talent?.id ?? d?.talentId ?? "")) payload.talentId = nTalent || undefined;

      const nDesc = editDescription.trim();
      if (nDesc !== String(d?.detailModel?.description ?? "")) payload.description = nDesc || undefined;
      const nAcq = editAcquisition.trim();
      if (nAcq !== String(d?.detailModel?.acquisition ?? "")) payload.acquisition = nAcq || undefined;

      const nWiki = editWikiUrl.trim();
      if (nWiki !== String(d?.wikiUrl ?? "")) payload.wikiUrl = nWiki || undefined;
      const nImg = editImageUrl.trim();
      if (nImg !== String(d?.imageUrl ?? "")) payload.imageUrl = nImg || undefined;
      const nTarget = editTargetLootRef.trim();
      if (nTarget !== String(d?.targetLootRef ?? "")) payload.targetLootRef = nTarget || undefined;
      const nNotes = editNotes.trim();
      if (nNotes !== String(d?.notes ?? "")) payload.notes = nNotes || undefined;

      const parsedDetails = parseDetailEntriesJson(editDetailEntriesJson);
      if (parsedDetails) payload.detailEntries = parsedDetails;

      if (!Object.keys(payload).length) {
        setEditErr(tx("Nada para salvar (sem alterações).", "Nothing to save (no changes)."));
        return;
      }

      const path = editTarget.type === "weapon" ? `/admin/weapons/${editTarget.id}` : `/admin/gear-items/${editTarget.id}`;
      await apiPut(path, payload);

      // refresh lists and open modals
      setEditTarget(null);
      setEditHydrated(false);
      if (selected?.id === editTarget.id && selected.type === editTarget.type) {
        // refetch detail view
        // (react-query will refetch automatically on focus; set selection unchanged)
      }
    } catch (e: any) {
      setEditErr(e?.message ?? String(e));
    }
  };

  const openCreateSet = (q: string) => {
    const name = String(q ?? "").trim();
    if (!name) return;
    setCreateSetErr(null);
    setCreateSetName(name);
    setCreateSetDescription("");
    setCreateSetBonus2("");
    setCreateSetBonus3("");
    setCreateSetBonus4("");
    setCreateSetWikiUrl("");
    setCreateSetLogoUrl("");
    setCreateSetOpen(true);
  };

  const submitCreateSet = async () => {
    const name = createSetName.trim();
    if (!name) {
      setCreateSetErr(tx("Nome do Gear Set é obrigatório.", "Gear set name is required."));
      return;
    }
    if (!canEdit) {
      setCreateSetErr(tx("Você precisa estar logado como admin para criar.", "You must be logged in as admin to create."));
      return;
    }

    const existing = resolveGearSetByName(name);
    if (existing) {
      setEditSetId(existing.id);
      setEditSetName(existing.name);
      setCreateSetOpen(false);
      return;
    }

    try {
      setCreateSetBusy(true);
      setCreateSetErr(null);
      const created = await apiPost<GearSet>("/admin/gear-sets", {
        name,
        description: createSetDescription.trim() || undefined,
        bonus2: createSetBonus2.trim() || undefined,
        bonus3: createSetBonus3.trim() || undefined,
        bonus4: createSetBonus4.trim() || undefined,
        wikiUrl: createSetWikiUrl.trim() || undefined,
        logoUrl: createSetLogoUrl.trim() || undefined,
      });

      await qc.invalidateQueries({ queryKey: ["catalog-gear-sets"] });

      setEditSetId(created.id);
      setEditSetName(created.name);
      setCreateSetOpen(false);
    } catch (e: any) {
      setCreateSetErr(e?.message ?? String(e));
    } finally {
      setCreateSetBusy(false);
    }
  };

  const previewProps = useMemo(() => {
    if (!selectedDetail.data || !selected) return null;
    const d: any = selectedDetail.data as any;
    const dm = d?.detailModel;
    if (selected.type === "weapon") {
      const weaponModsPreview = [
        readDetailValue(dm, "weapon_mods", "Mod_Pente") ? `Pente: ${readDetailValue(dm, "weapon_mods", "Mod_Pente")}` : null,
        readDetailValue(dm, "weapon_mods", "Mod_Mira") ? `Mira: ${readDetailValue(dm, "weapon_mods", "Mod_Mira")}` : null,
        readDetailValue(dm, "weapon_mods", "Mod_Bocal") ? `Bocal: ${readDetailValue(dm, "weapon_mods", "Mod_Bocal")}` : null,
        readDetailValue(dm, "weapon_mods", "Mod_SuporteInferior") ? `Suporte: ${readDetailValue(dm, "weapon_mods", "Mod_SuporteInferior")}` : null,
      ].filter(Boolean) as string[];

      return {
        tx,
        sticky: false,
        type: "weapon" as const,
        slot: "",
        rarity: String(d?.rarity ?? ""),
        weaponClass: String(d?.class ?? ""),
        name: String(d?.name ?? ""),
        id: String(d?.id ?? ""),
        description: String(dm?.description ?? ""),
        selectedBrandName: null,
        selectedSetName: null,
        brandBonuses: [],
        setBonuses: [],
        gearCorePreview: "-",
        talentId: String(d?.talent?.id ?? d?.talentId ?? ""),
        talentName: String(d?.talent?.name ?? ""),
        modSlots: "",
        acquisition: String(dm?.acquisition ?? ""),
        weaponTotalDamage: readDetailValue(dm, "weapon_stats", "TotalDamage"),
        weaponBaseDamage: String(d?.baseDamage ?? ""),
        weaponRpm: d?.rpm !== null && d?.rpm !== undefined ? String(d.rpm) : "",
        weaponMagSize: d?.magSize !== null && d?.magSize !== undefined ? String(d.magSize) : "",
        weaponDpm: readDetailValue(dm, "weapon_stats", "DPM"),
        weaponPnt: readDetailValue(dm, "weapon_stats", "PNT"),
        weaponOptimalRange: readDetailValue(dm, "weapon_stats", "OptimalRange"),
        weaponHeadshotPct: readDetailValue(dm, "weapon_stats", "HeadshotDamagePct"),
        weaponCoreAttribute: readDetailValue(dm, "weapon_config", "AtributoCentral"),
        weaponAttribute: readDetailValue(dm, "weapon_config", "Atributo"),
        weaponExpertise: readDetailValue(dm, "weapon_config", "Pericia"),
        weaponModsPreview,
      };
    }

    const core = Array.isArray(d?.stats) ? d.stats.find((s: any) => s?.kind === "core") : null;
    const minors = (Array.isArray(d?.stats) ? d.stats.filter((s: any) => s?.kind === "minor") : []).slice(0, 2);
    const mods = (Array.isArray(d?.mods) ? d.mods : []).slice(0, 2);

    return {
      tx,
      sticky: false,
      type: "gear" as const,
      slot: String(d?.slot ?? ""),
      rarity: String(d?.rarity ?? ""),
      weaponClass: "",
      name: String(d?.name ?? ""),
      id: String(d?.id ?? ""),
      description: String(dm?.description ?? ""),
      selectedBrandName: d?.brand?.name ?? null,
      selectedSetName: d?.gearSet?.name ?? null,
      selectedSetDescription: d?.gearSet?.description ?? null,
      brandBonuses: [d?.brand?.bonus1, d?.brand?.bonus2, d?.brand?.bonus3].filter(Boolean),
      setBonuses: [d?.gearSet?.bonus2, d?.gearSet?.bonus3, d?.gearSet?.bonus4].filter(Boolean),
      gearCorePreview: d?.coreColor ? `${d.coreColor} x${d.coreCount ?? 1}` : "-",
      gearCoreName: String(core?.name ?? ""),
      gearCoreValue: String(core?.value ?? ""),
      gearArmorValue: readDetailValue(dm, "gear_header", "ArmorValue"),
      gearProficiencyRank: readDetailValue(dm, "gear_proficiency", "ProficiencyRank"),
      gearProficiencyProgress: readDetailValue(dm, "gear_proficiency", "ProficiencyProgress"),
      gearProficiencyMax: readDetailValue(dm, "gear_proficiency", "ProficiencyMax"),
      gearMinorAttrs: minors.map((m: any) => ({ name: String(m?.name ?? ""), value: String(m?.value ?? "") })).filter((x: any) => x.name),
      gearMods: mods
        .map((m: any) => `${String(m?.name ?? "")}${m?.value ? `: ${m.value}` : ""}`)
        .filter((x: any) => String(x).trim()),
      talentId: String(d?.talent?.id ?? d?.talentId ?? ""),
      talentName: String(d?.talent?.name ?? ""),
      modSlots: d?.modSlots !== null && d?.modSlots !== undefined ? String(d.modSlots) : "",
      acquisition: String(dm?.acquisition ?? ""),
      weaponTotalDamage: "",
      weaponBaseDamage: "",
      weaponRpm: "",
      weaponMagSize: "",
      weaponDpm: "",
      weaponPnt: "",
      weaponOptimalRange: "",
      weaponHeadshotPct: "",
      weaponCoreAttribute: "",
      weaponAttribute: "",
      weaponExpertise: "",
      weaponModsPreview: [],
    };
  }, [selectedDetail.data, selected, tx]);

  const gearItemsFiltered = useMemo(() => {
    const items = gear.data?.items ?? [];
    if (!ownedFilter) return items;
    const wantOwned = ownedFilter === "owned";
    return items.filter((it) => Boolean(acquired[it.id]) === wantOwned);
  }, [gear.data?.items, ownedFilter, acquired]);

  const weaponItemsFiltered = useMemo(() => {
    const items = weapons.data?.items ?? [];
    if (!ownedFilter) return items;
    const wantOwned = ownedFilter === "owned";
    return items.filter((it) => Boolean(acquired[it.id]) === wantOwned);
  }, [weapons.data?.items, ownedFilter, acquired]);

  const gearTotal = gear.data?.total ?? 0;
  const weaponTotal = weapons.data?.total ?? 0;
  const gearSkip = pageGear * PAGE_SIZE;
  const weaponSkip = pageWeapon * PAGE_SIZE;
  const gearPageItems = gear.data?.items ?? [];
  const weaponPageItems = weapons.data?.items ?? [];
  const gearTotalPages = gearTotal ? Math.max(1, Math.ceil(gearTotal / PAGE_SIZE)) : 0;
  const weaponTotalPages = weaponTotal ? Math.max(1, Math.ceil(weaponTotal / PAGE_SIZE)) : 0;

  useEffect(() => {
    if (!gearTotalPages) return;
    setPageGear((p) => (p >= gearTotalPages ? gearTotalPages - 1 : p));
  }, [gearTotalPages]);
  useEffect(() => {
    if (!weaponTotalPages) return;
    setPageWeapon((p) => (p >= weaponTotalPages ? weaponTotalPages - 1 : p));
  }, [weaponTotalPages]);

  return (
    <div className="td2-page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="td2-label">{tx("Buscar", "Search")}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="td2-input mt-1 w-full px-3 py-2 text-sm"
            placeholder={tx("Striker, Providence, Máscara...", "Striker, Providence, Mask...")}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="td2-label">{tx("Tipo", "Type")}</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`td2-btn px-3 py-2 text-sm ${tab === "gear" ? "border-orange-500/50" : ""}`}
              onClick={() => setTab("gear")}
            >
              {tx("Gear", "Gear")}
            </button>
            <button
              type="button"
              className={`td2-btn px-3 py-2 text-sm ${tab === "weapon" ? "border-orange-500/50" : ""}`}
              onClick={() => setTab("weapon")}
            >
              {tx("Armas", "Weapons")}
            </button>
          </div>
        </div>
        {tab === "gear" ? (
          <div className="w-full sm:w-56">
            <label className="td2-label">{tx("Slot", "Slot")}</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="td2-select mt-1 w-full px-3 py-2 text-sm"
            >
              <option value="">{tx("Todos", "All")}</option>
              <option value="Mask">{tx("Máscara", "Mask")}</option>
              <option value="Chest">{tx("Peitoral", "Chest")}</option>
              <option value="Backpack">{tx("Mochila", "Backpack")}</option>
              <option value="Gloves">{tx("Luvas", "Gloves")}</option>
              <option value="Holster">{tx("Coldre", "Holster")}</option>
              <option value="Kneepads">{tx("Joelheiras", "Kneepads")}</option>
            </select>
          </div>
        ) : (
          <div className="w-full sm:w-56">
            <label className="td2-label">{tx("Classe", "Class")}</label>
            <select
              value={weaponClass}
              onChange={(e) => setWeaponClass(e.target.value)}
              className="td2-select mt-1 w-full px-3 py-2 text-sm"
            >
              <option value="">{tx("Todas", "All")}</option>
              <option value="AR">AR</option>
              <option value="SMG">SMG</option>
              <option value="LMG">LMG</option>
              <option value="Rifle">Rifle</option>
              <option value="MMR">MMR</option>
              <option value="Shotgun">Shotgun</option>
              <option value="Pistol">Pistol</option>
            </select>
          </div>
        )}
        <div className="w-full sm:w-56">
          <label className="td2-label">{tx("Raridade", "Rarity")}</label>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="td2-select mt-1 w-full px-3 py-2 text-sm"
          >
            <option value="">{tx("Todas", "All")}</option>
            <option value="HighEnd">HighEnd</option>
            <option value="Named">Named</option>
            <option value="Exotic">Exotic</option>
            {tab === "gear" ? <option value="GearSet">GearSet</option> : null}
          </select>
        </div>
        <div className="w-full sm:w-56">
          <label className="td2-label">{tx("Status", "Status")}</label>
          <select
            value={ownedFilter}
            onChange={(e) => setOwnedFilter(e.target.value as any)}
            className="td2-select mt-1 w-full px-3 py-2 text-sm"
          >
            <option value="">{tx("Todos", "All")}</option>
            <option value="owned">{tx("Adquiridos", "Owned")}</option>
            <option value="missing">{tx("Faltando", "Missing")}</option>
          </select>
        </div>
      </div>

        <div className="td2-card rounded-2xl overflow-hidden">
        <div className="td2-card-header px-4 py-3 flex items-center justify-between">
          <div className="td2-heading text-sm font-medium">
            {tab === "gear" ? tx("Itens de Gear", "Gear Items") : tx("Armas", "Weapons")}
          </div>
          <div className="td2-muted text-xs">
            {tab === "gear" ? (
              gear.isLoading ? (
                tx("Carregando...", "Loading...")
              ) : gearTotal ? (
                <>
                  {gearSkip + 1}-{gearSkip + gearPageItems.length} / {gearTotal} {tx("total", "total")}
                  {ownedFilter && gearItemsFiltered.length !== gearPageItems.length ? (
                    <span className="ml-2">
                      ({gearItemsFiltered.length} {tx("após filtro", "after filter")})
                    </span>
                  ) : null}
                </>
              ) : (
                `0/0 ${tx("total", "total")}`
              )
            ) : weapons.isLoading ? (
              tx("Carregando...", "Loading...")
            ) : weaponTotal ? (
              <>
                {weaponSkip + 1}-{weaponSkip + weaponPageItems.length} / {weaponTotal} {tx("total", "total")}
                {ownedFilter && weaponItemsFiltered.length !== weaponPageItems.length ? (
                  <span className="ml-2">
                    ({weaponItemsFiltered.length} {tx("após filtro", "after filter")})
                  </span>
                ) : null}
              </>
            ) : (
              `0/0 ${tx("total", "total")}`
            )}
          </div>
        </div>

        {tab === "gear" && gear.isError ? (
          <div className="p-4 text-sm text-red-300">{tx("Erro", "Error")}: {(gear.error as any)?.message}</div>
        ) : tab === "weapon" && weapons.isError ? (
          <div className="p-4 text-sm text-red-300">{tx("Erro", "Error")}: {(weapons.error as any)?.message}</div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {tab === "gear"
              ? gearItemsFiltered.map((it) => (
                  <div key={it.id} className={`td2-list-row ${rarityRowClass(it.rarity)} p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{it.name}</div>
                      <div className="td2-muted text-xs">
                        <span className="mr-2">{it.slot}</span>
                        <span className="mr-2">{it.rarity}</span>
                        {it.coreColor ? <span className="mr-2">{tx("Core", "Core")}: {it.coreColor}</span> : null}
                        {it.brand?.name ? <span className="mr-2">{tx("Marca", "Brand")}: {it.brand.name}</span> : null}
                        {it.gearSet?.name ? <span className="mr-2">{tx("Set", "Set")}: {it.gearSet.name}</span> : null}
                        {it.talent?.name ? <span className="mr-2">{tx("Talento", "Talent")}: {it.talent.name}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
                      <code className="td2-code px-2 py-1 text-[11px]">{it.id}</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(it.id)}
                        className="td2-btn text-[11px] px-2.5 py-1.5"
                        title={tx("Copiar ID", "Copy ID")}
                      >
                        {copiedId === it.id ? tx("Copiado", "Copied") : tx("Copiar", "Copy")}
                      </button>
                      <label className="td2-owned">
                        <input
                          className="td2-check"
                          type="checkbox"
                          checked={Boolean(acquired[it.id])}
                          onChange={(e) => setAcquiredFor(it.id, e.target.checked)}
                        />
                        <span>{tx("Adquirido", "Owned")}</span>
                      </label>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget({ type: "gear", id: it.id });
                            setEditHydrated(false);
                          }}
                          className="td2-btn text-xs px-3 py-1.5"
                        >
                          {tx("Editar", "Edit")}
                        </button>
                      ) : null}
                      <button
                        onClick={() => setSelected({ type: "gear", id: it.id })}
                        className="td2-btn td2-btn--accent text-xs px-3 py-1.5"
                      >
                        {tx("Detalhes", "Details")}
                      </button>
                    </div>
                  </div>
                ))
              : weaponItemsFiltered.map((it) => (
                  <div key={it.id} className={`td2-list-row ${rarityRowClass(it.rarity)} p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{it.name}</div>
                      <div className="td2-muted text-xs">
                        <span className="mr-2">{it.class}</span>
                        <span className="mr-2">{it.rarity}</span>
                        {it.baseDamage ? <span className="mr-2">{tx("Dano base", "Base damage")}: {it.baseDamage}</span> : null}
                        {typeof it.rpm === "number" ? <span className="mr-2">RPM: {it.rpm}</span> : null}
                        {typeof it.magSize === "number" ? <span className="mr-2">{tx("Pente", "Mag")}: {it.magSize}</span> : null}
                        {it.talent?.name ? <span className="mr-2">{tx("Talento", "Talent")}: {it.talent.name}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
                      <code className="td2-code px-2 py-1 text-[11px]">{it.id}</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(it.id)}
                        className="td2-btn text-[11px] px-2.5 py-1.5"
                        title={tx("Copiar ID", "Copy ID")}
                      >
                        {copiedId === it.id ? tx("Copiado", "Copied") : tx("Copiar", "Copy")}
                      </button>
                      <label className="td2-owned">
                        <input
                          className="td2-check"
                          type="checkbox"
                          checked={Boolean(acquired[it.id])}
                          onChange={(e) => setAcquiredFor(it.id, e.target.checked)}
                        />
                        <span>{tx("Adquirido", "Owned")}</span>
                      </label>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget({ type: "weapon", id: it.id });
                            setEditHydrated(false);
                          }}
                          className="td2-btn text-xs px-3 py-1.5"
                        >
                          {tx("Editar", "Edit")}
                        </button>
                      ) : null}
                      <button
                        onClick={() => setSelected({ type: "weapon", id: it.id })}
                        className="td2-btn td2-btn--accent text-xs px-3 py-1.5"
                      >
                        {tx("Detalhes", "Details")}
                      </button>
                    </div>
                  </div>
                ))}

            {tab === "gear" && !gear.isLoading && gearItemsFiltered.length === 0 ? (
              <div className="p-4 text-sm td2-muted">{tx("Sem itens ainda. Importe seu XLSX no Admin.", "No items yet. Import your XLSX on Admin.")}</div>
            ) : null}
            {tab === "weapon" && !weapons.isLoading && weaponItemsFiltered.length === 0 ? (
              <div className="p-4 text-sm td2-muted">{tx("Sem armas ainda. Importe seu XLSX no Admin.", "No weapons yet. Import your XLSX on Admin.")}</div>
            ) : null}

            {tab === "gear" && gearTotalPages > 1 ? (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800/70">
                <div className="text-xs td2-muted">
                  {tx("Página", "Page")} {pageGear + 1} / {gearTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="td2-btn text-xs px-3 py-1.5"
                    onClick={() => setPageGear((p) => Math.max(0, p - 1))}
                    disabled={pageGear <= 0}
                  >
                    {tx("Anterior", "Prev")}
                  </button>
                  <button
                    type="button"
                    className="td2-btn td2-btn--accent text-xs px-3 py-1.5"
                    onClick={() => setPageGear((p) => Math.min(gearTotalPages - 1, p + 1))}
                    disabled={pageGear >= gearTotalPages - 1}
                  >
                    {tx("Próxima", "Next")}
                  </button>
                </div>
              </div>
            ) : null}

            {tab === "weapon" && weaponTotalPages > 1 ? (
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800/70">
                <div className="text-xs td2-muted">
                  {tx("Página", "Page")} {pageWeapon + 1} / {weaponTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="td2-btn text-xs px-3 py-1.5"
                    onClick={() => setPageWeapon((p) => Math.max(0, p - 1))}
                    disabled={pageWeapon <= 0}
                  >
                    {tx("Anterior", "Prev")}
                  </button>
                  <button
                    type="button"
                    className="td2-btn td2-btn--accent text-xs px-3 py-1.5"
                    onClick={() => setPageWeapon((p) => Math.min(weaponTotalPages - 1, p + 1))}
                    disabled={pageWeapon >= weaponTotalPages - 1}
                  >
                    {tx("Próxima", "Next")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selected ? (
        <div className="td2-overlay fixed inset-0 z-50">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="td2-modal w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl">
              <div className="td2-card-header sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] td2-muted uppercase tracking-[0.12em] truncate">
                    {selectedHeader?.kicker ?? tx("Detalhes do Item", "Item Details")}
                  </div>
                  <div className="td2-heading text-sm font-semibold truncate">
                    {selectedHeader?.name || tx("Detalhes do Item", "Item Details")}
                    {selectedHeader?.id ? <span className="ml-2 text-[11px] td2-muted font-mono">({selectedHeader.id})</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {selected?.id ? (
                    <label className="inline-flex items-center gap-2 text-[11px] td2-muted select-none">
                      <input
                        type="checkbox"
                        checked={selectedAcquired}
                        onChange={(e) => setAcquiredFor(selected.id, e.target.checked)}
                      />
                      {tx("Adquirido", "Owned")}
                    </label>
                  ) : null}
                  {canEdit && selected?.id ? (
                    <button
                      type="button"
                      className="td2-btn text-xs px-3 py-1.5"
                      onClick={() => {
                        setEditTarget({ type: selected.type, id: selected.id });
                        setEditHydrated(false);
                      }}
                    >
                      {tx("Editar", "Edit")}
                    </button>
                  ) : null}
                  <button
                    onClick={() => setSelected(null)}
                    className="td2-btn text-xs px-3 py-1.5"
                  >
                    {tx("Fechar", "Close")}
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {selectedDetail.isLoading ? (
                  <div className="text-sm td2-muted">{tx("Carregando detalhes...", "Loading details...")}</div>
                ) : selectedDetail.isError ? (
                  <div className="text-sm text-red-300">{tx("Erro", "Error")}: {(selectedDetail.error as any)?.message}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
                      <div>
                        {previewProps ? <ItemPreviewCard {...(previewProps as any)} /> : null}
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="td2-card rounded-xl p-3">
                            <div className="td2-label">{tx("Aquisição", "Acquisition")}</div>
                            <div className="text-sm text-slate-200 mt-1">{(selectedDetail.data as any)?.detailModel?.acquisition ?? "-"}</div>
                          </div>
                          <div className="td2-card rounded-xl p-3">
                            <div className="td2-label">{tx("Categoria de Perícia", "Expertise Category")}</div>
                            <div className="text-sm text-slate-200 mt-1">{(selectedDetail.data as any)?.detailModel?.expertiseCategory ?? "-"}</div>
                          </div>
                        </div>

                        {(selectedDetail.data as any)?.rules?.length ? (
                          <div>
                            <div className="text-sm font-medium mb-2">{tx("Regras de Atributos", "Attribute Rules")}</div>
                            <div className="space-y-2">
                              {(selectedDetail.data as any).rules.map((r: any, idx: number) => (
                                <div key={idx} className="rounded-xl border border-slate-800 p-3 text-xs">
                                  <div className="font-semibold text-slate-200">
                                    {r.attribute?.name ?? tx("Atributo", "Attribute")}
                                    {r.attribute?.unit ? ` (${r.attribute.unit})` : ""}
                                  </div>
                                  <div className="td2-muted mt-1">
                                    {r.isCore ? tx("Core", "Core") : r.isMinor ? tx("Menor", "Minor") : tx("Regra", "Rule")}
                                    {r.minValue || r.maxValue ? ` · ${r.minValue ?? "?"} - ${r.maxValue ?? "?"}` : ""}
                                  </div>
                                  {r.notes ? <div className="text-slate-300 mt-1">{r.notes}</div> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {Object.keys(groupedDetails).length ? (
                          <div>
                            <div className="text-sm font-medium mb-2">{tx("Detalhes Estendidos", "Extended Details")}</div>
                            <div className="space-y-3">
                              {Object.entries(groupedDetails).map(([group, entries]) => {
                                const gKey = String(group ?? "");
                                const gLower = gKey.toLowerCase();
                                const getV = (k: string) => String(entries.find((e) => e.key === k)?.value ?? "").trim();

                                const renderPairs = (pairs: Array<{ name: string; value: string; fallbackName: string }>) => (
                                  <div className="space-y-2">
                                    {pairs
                                      .filter((p) => p.name || p.value)
                                      .map((p, idx) => (
                                        <div key={idx} className="text-xs border border-slate-800/70 rounded-lg p-2 bg-slate-900/40 flex items-center justify-between gap-3">
                                          <div className="font-semibold text-slate-200 truncate">{p.name || p.fallbackName}</div>
                                          <div className="text-slate-100 font-mono shrink-0">{p.value || "-"}</div>
                                        </div>
                                      ))}
                                  </div>
                                );

                                if (gLower === "gear_attrs") {
                                  const pairs = [
                                    { name: getV("Attr1Name"), value: getV("Attr1Value"), fallbackName: tx("Atributo 1", "Attribute 1") },
                                    { name: getV("Attr2Name"), value: getV("Attr2Value"), fallbackName: tx("Atributo 2", "Attribute 2") },
                                  ];
                                  return (
                                    <div key={group} className="td2-card rounded-xl p-3">
                                      <div className="td2-label mb-2">{groupLabel(tx, group)}</div>
                                      {renderPairs(pairs)}
                                    </div>
                                  );
                                }

                                if (gLower === "gear_mods") {
                                  const pairs = [
                                    { name: getV("Mod1Name"), value: getV("Mod1Value"), fallbackName: tx("Mod 1", "Mod 1") },
                                    { name: getV("Mod2Name"), value: getV("Mod2Value"), fallbackName: tx("Mod 2", "Mod 2") },
                                  ];
                                  return (
                                    <div key={group} className="td2-card rounded-xl p-3">
                                      <div className="td2-label mb-2">{groupLabel(tx, group)}</div>
                                      {renderPairs(pairs)}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={group} className="td2-card rounded-xl p-3">
                                    <div className="td2-label mb-2">{groupLabel(tx, group)}</div>
                                    <div className="space-y-2">
                                      {entries.map((e, idx) => (
                                        <div key={idx} className="text-xs border border-slate-800/70 rounded-lg p-2 bg-slate-900/40">
                                          <div className="font-semibold text-slate-200 flex items-center justify-between gap-3">
                                            <span className="truncate">{entryLabel(tx, group, e.key)}</span>
                                            <span className="text-slate-100 font-mono shrink-0">
                                              {e.value}{e.unit ? ` ${e.unit}` : ""}
                                            </span>
                                          </div>
                                          {e.minValue || e.maxValue ? (
                                            <div className="td2-muted mt-1">{tx("Faixa", "Range")}: {e.minValue ?? "?"} - {e.maxValue ?? "?"}</div>
                                          ) : null}
                                          {e.notes ? <div className="text-slate-300 mt-1">{e.notes}</div> : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs td2-muted">{tx("Sem detalhes estendidos para este item ainda.", "No extended details for this item yet.")}</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="td2-overlay fixed inset-0 z-[60]">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="td2-modal w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl">
              <div className="td2-card-header sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] td2-muted uppercase tracking-[0.12em] truncate">
                    {tx("Editar item", "Edit item")} · {editTarget.type === "weapon" ? tx("Arma", "Weapon") : tx("Gear", "Gear")} · {editTarget.id}
                  </div>
                  <div className="td2-heading text-sm font-semibold truncate">{editName || tx("Item", "Item")}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="td2-btn text-xs px-3 py-1.5"
                    onClick={() => {
                      setEditTarget(null);
                      setEditHydrated(false);
                    }}
                  >
                    {tx("Fechar", "Close")}
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {editDetail.isLoading ? (
                  <div className="text-sm td2-muted">{tx("Carregando...", "Loading...")}</div>
                ) : editDetail.isError ? (
                  <div className="text-sm text-red-300">{tx("Erro", "Error")}: {(editDetail.error as any)?.message}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Nome", "Name")} />
                      <select value={editRarity} onChange={(e) => setEditRarity(e.target.value)} className="td2-select px-3 py-2 text-sm">
                        {RARITIES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {editTarget.type === "gear" ? (
                        <select value={editSlot} onChange={(e) => setEditSlot(e.target.value)} className="td2-select px-3 py-2 text-sm">
                          {GEAR_SLOTS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <select value={editWeaponClass} onChange={(e) => setEditWeaponClass(e.target.value)} className="td2-select px-3 py-2 text-sm">
                          {WEAPON_CLASSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                      <input value={editTalentId} onChange={(e) => setEditTalentId(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("talentId (opcional)", "talentId (optional)")} />
                    </div>

                    {editTarget.type === "gear" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={editBrandId} onChange={(e) => setEditBrandId(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("brandId (opcional)", "brandId (optional)")} />
                        <ComboBox
                          value={editSetName}
                          onChange={(next) => {
                            setEditSetName(next);
                            if (!next.trim()) {
                              setEditSetId("");
                              return;
                            }
                            const hit = resolveGearSetByName(next);
                            if (hit) setEditSetId(hit.id);
                            else setEditSetId("");
                          }}
                          onPick={(opt) => {
                            setEditSetName(opt.label);
                            setEditSetId(opt.id);
                          }}
                          options={gearSetOptions}
                          allowCreate={canEdit}
                          onCreate={(name) => openCreateSet(name)}
                          createLabel={(name) => tx(`Criar Gear Set "${name}"`, `Create Gear Set "${name}"`)}
                          placeholder={tx("Gear Set (digite para buscar/criar)", "Gear set (type to search/create)")}
                          className="td2-input px-3 py-2 text-sm"
                        />
                        <select value={editCoreColor} onChange={(e) => setEditCoreColor(e.target.value)} className="td2-select px-3 py-2 text-sm">
                          <option value="">{tx("coreColor (opcional)", "coreColor (optional)")}</option>
                          {CORE_COLORS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input value={editCoreCount} onChange={(e) => setEditCoreCount(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="coreCount (ex: 1)" inputMode="numeric" />
                        <input value={editModSlots} onChange={(e) => setEditModSlots(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="modSlots (ex: 1)" inputMode="numeric" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input value={editBaseDamage} onChange={(e) => setEditBaseDamage(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Dano base (texto)", "Base damage (text)")} />
                        <input value={editRpm} onChange={(e) => setEditRpm(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="rpm" inputMode="numeric" />
                        <input value={editMagSize} onChange={(e) => setEditMagSize(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="magSize" inputMode="numeric" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Descrição (opcional)", "Description (optional)")} />
                      <input value={editAcquisition} onChange={(e) => setEditAcquisition(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Aquisição (opcional)", "Acquisition (optional)")} />
                      <input value={editWikiUrl} onChange={(e) => setEditWikiUrl(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="wikiUrl (optional)" />
                      <input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="imageUrl (optional)" />
                      <input value={editTargetLootRef} onChange={(e) => setEditTargetLootRef(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="targetLootRef (optional)" />
                      <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="notes (optional)" />
                    </div>

                    <div>
                      <div className="td2-label mb-2">detailEntries (JSON)</div>
                      <textarea
                        value={editDetailEntriesJson}
                        onChange={(e) => setEditDetailEntriesJson(e.target.value)}
                        rows={8}
                        className="td2-textarea w-full px-3 py-2 text-xs font-mono"
                        placeholder='[{"group":"gear_core","key":"CoreValue","value":"15%","order":2}]'
                      />
                      <div className="text-[11px] td2-muted mt-1">
                        {tx("Dica: deixe vazio para não mexer. Se preencher, será enviado no update.", "Tip: leave empty to not change. If filled, it will be sent in the update.")}
                      </div>
                    </div>

                    {editErr ? <div className="text-xs text-red-300">{editErr}</div> : null}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="td2-btn td2-btn--accent px-4 py-2 text-sm"
                        onClick={saveEdit}
                      >
                        {tx("Salvar alterações", "Save changes")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createSetOpen ? (
        <div className="td2-overlay fixed inset-0 z-[70]">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="td2-modal w-full max-w-2xl rounded-2xl">
              <div className="td2-card-header px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] td2-muted uppercase tracking-[0.12em] truncate">{tx("Novo Gear Set", "New Gear Set")}</div>
                  <div className="td2-heading text-sm font-semibold truncate">{createSetName || tx("Gear Set", "Gear Set")}</div>
                </div>
                <button
                  type="button"
                  className="td2-btn text-xs px-3 py-1.5"
                  onClick={() => {
                    setCreateSetOpen(false);
                    setCreateSetErr(null);
                  }}
                  disabled={createSetBusy}
                >
                  {tx("Fechar", "Close")}
                </button>
              </div>

              <div className="p-4 space-y-3">
                <input
                  value={createSetName}
                  onChange={(e) => setCreateSetName(e.target.value)}
                  className="td2-input px-3 py-2 text-sm"
                  placeholder={tx("Nome do Gear Set", "Gear set name")}
                  autoFocus
                />
                <textarea
                  value={createSetDescription}
                  onChange={(e) => setCreateSetDescription(e.target.value)}
                  rows={4}
                  className="td2-textarea w-full px-3 py-2 text-sm"
                  placeholder={tx("Descrição (opcional)", "Description (optional)")}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={createSetBonus2} onChange={(e) => setCreateSetBonus2(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Bônus 2p (opcional)", "2pc bonus (optional)")} />
                  <input value={createSetBonus3} onChange={(e) => setCreateSetBonus3(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Bônus 3p (opcional)", "3pc bonus (optional)")} />
                  <input value={createSetBonus4} onChange={(e) => setCreateSetBonus4(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder={tx("Bônus 4p (opcional)", "4pc bonus (optional)")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={createSetWikiUrl} onChange={(e) => setCreateSetWikiUrl(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="wikiUrl (optional)" />
                  <input value={createSetLogoUrl} onChange={(e) => setCreateSetLogoUrl(e.target.value)} className="td2-input px-3 py-2 text-sm" placeholder="logoUrl (optional)" />
                </div>

                {createSetErr ? <div className="text-xs text-red-300">{createSetErr}</div> : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="td2-btn td2-btn--accent px-4 py-2 text-sm"
                    onClick={submitCreateSet}
                    disabled={createSetBusy}
                  >
                    {createSetBusy ? tx("Criando...", "Creating...") : tx("Criar Gear Set", "Create Gear Set")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
