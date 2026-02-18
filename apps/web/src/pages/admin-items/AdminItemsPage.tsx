import { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api/http";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n";
import ItemPreviewCard from "./components/ItemPreviewCard";
import ComboBox from "../../components/ComboBox";
import {
  ATTRIBUTE_CATEGORY_OPTIONS,
  CORE_COLOR_OPTIONS,
  GEAR_CORE_ATTRIBUTE_OPTIONS,
  GEAR_MINOR_ATTRIBUTE_OPTIONS,
  GEAR_MOD_SLOT_OPTIONS,
  RARITY_OPTIONS,
  SLOT_OPTIONS,
  TALENT_TYPE_OPTIONS,
  WEAPON_CLASS_OPTIONS,
  WEAPON_CORE_ATTRIBUTE_OPTIONS,
  type BrandOption,
  type GearFormMode,
  type GearSetOption,
  type ItemType,
} from "./constants";
import { parseDetailEntries, parseOptionalInt } from "./helpers";

type IdResponse = { id?: string } & Record<string, any>;

type GearStep = "basic" | "brandset" | "core" | "prof" | "attrs" | "mods" | "advanced";
type WeaponStep = "basic" | "stats" | "attrs" | "mods" | "advanced";
type TalentOption = { id: string; name: string; type: string };
type DetailEntry = { group?: string | null; key: string; value: string; unit?: string | null; order?: number | null };

function GearAcc({
  step,
  title,
  summary,
  children,
  innerRef,
  openStep,
  setOpenStep,
  stepOk,
  stepOrder,
  nextMissingStep,
  gotoStep,
  tx,
}: {
  step: GearStep;
  title: string;
  summary: string;
  children: React.ReactNode;
  innerRef: React.Ref<HTMLDivElement>;
  openStep: GearStep | null;
  setOpenStep: React.Dispatch<React.SetStateAction<GearStep | null>>;
  stepOk: Record<GearStep, boolean>;
  stepOrder: GearStep[];
  nextMissingStep: GearStep | null;
  gotoStep: (s: GearStep) => void;
  tx: (pt: string, en: string) => string;
}) {
  const isOpen = openStep === step;
  const ok = stepOk[step];
  const idx = stepOrder.indexOf(step);
  const prev = idx > 0 ? stepOrder[idx - 1] : null;
  const next = idx >= 0 && idx < stepOrder.length - 1 ? stepOrder[idx + 1] : null;
  return (
    <div ref={innerRef} className="td2-acc">
      <button
        type="button"
        onClick={() => setOpenStep((cur) => (cur === step ? null : step))}
        className="td2-acc__hdr"
      >
        <div className="td2-acc__title">
          <span className={`td2-badge ${ok ? "td2-badge--ok" : "td2-badge--muted"}`}>
            <span className="td2-badge__dot" />
            <span className="td2-acc__kicker">{title}</span>
          </span>
          <span className="td2-acc__summary">{summary}</span>
        </div>
        <span className="td2-acc__chev">{isOpen ? "v" : ">"}</span>
      </button>
      {isOpen ? (
        <div className="td2-acc__body">
          {children}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {prev ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoStep(prev)}>
                  {tx("Voltar", "Back")}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {nextMissingStep ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoStep(nextMissingStep)}>
                  {tx("Ir para o que falta", "Go to missing")}
                </button>
              ) : null}
              {next ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoStep(next)}>
                  {tx("Próximo", "Next")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WeaponAcc({
  step,
  title,
  summary,
  children,
  innerRef,
  openWeaponStep,
  setOpenWeaponStep,
  weaponStepOk,
  weaponStepOrder,
  nextMissingWeaponStep,
  gotoWeaponStep,
  tx,
}: {
  step: WeaponStep;
  title: string;
  summary: string;
  children: React.ReactNode;
  innerRef: React.Ref<HTMLDivElement>;
  openWeaponStep: WeaponStep | null;
  setOpenWeaponStep: React.Dispatch<React.SetStateAction<WeaponStep | null>>;
  weaponStepOk: Record<WeaponStep, boolean>;
  weaponStepOrder: WeaponStep[];
  nextMissingWeaponStep: WeaponStep | null;
  gotoWeaponStep: (s: WeaponStep) => void;
  tx: (pt: string, en: string) => string;
}) {
  const isOpen = openWeaponStep === step;
  const ok = weaponStepOk[step];
  const idx = weaponStepOrder.indexOf(step);
  const prev = idx > 0 ? weaponStepOrder[idx - 1] : null;
  const next = idx >= 0 && idx < weaponStepOrder.length - 1 ? weaponStepOrder[idx + 1] : null;
  return (
    <div ref={innerRef} className="td2-acc">
      <button
        type="button"
        onClick={() => setOpenWeaponStep((cur) => (cur === step ? null : step))}
        className="td2-acc__hdr"
      >
        <div className="td2-acc__title">
          <span className={`td2-badge ${ok ? "td2-badge--ok" : "td2-badge--muted"}`}>
            <span className="td2-badge__dot" />
            <span className="td2-acc__kicker">{title}</span>
          </span>
          <span className="td2-acc__summary">{summary}</span>
        </div>
        <span className="td2-acc__chev">{isOpen ? "v" : ">"}</span>
      </button>
      {isOpen ? (
        <div className="td2-acc__body">
          {children}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {prev ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoWeaponStep(prev)}>
                  {tx("Voltar", "Back")}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {nextMissingWeaponStep ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoWeaponStep(nextMissingWeaponStep)}>
                  {tx("Ir para o que falta", "Go to missing")}
                </button>
              ) : null}
              {next ? (
                <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => gotoWeaponStep(next)}>
                  {tx("Próximo", "Next")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminItemsPage() {
  const { tx } = useI18n();
  const qc = useQueryClient();
  const DRAFT_META_KEY = "td2.adminItemsDraft.meta.v1";
  const DRAFT_GEAR_KEY = "td2.adminItemsDraft.gear.v1";
  const DRAFT_WEAPON_KEY = "td2.adminItemsDraft.weapon.v1";
  const LEGACY_DRAFT_KEY = "td2.adminItemsDraft.v1";
  const [type, setType] = useState<ItemType>("gear");
  const [gearFormMode, setGearFormMode] = useState<GearFormMode>("quick");
  const [weaponFormMode, setWeaponFormMode] = useState<GearFormMode>("quick");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [id, setItemId] = useState("");
  const [name, setName] = useState("");
  const [rarity, setRarity] = useState("HighEnd");
  const [slot, setSlot] = useState("Mask");
  const [brandId, setBrandId] = useState("");
  const [setId, setSetId] = useState("");
  const [gearSetName, setGearSetName] = useState("");
  const [belongsToGearSet, setBelongsToGearSet] = useState(false);
  const [gearCoreAttrName, setGearCoreAttrName] = useState<(typeof GEAR_CORE_ATTRIBUTE_OPTIONS)[number] | "">("");
  const [gearCoreAttrValue, setGearCoreAttrValue] = useState("");
  const [gearArmorValue, setGearArmorValue] = useState("");
  const [gearProficiencyRank, setGearProficiencyRank] = useState("");
  const [gearProficiencyProgress, setGearProficiencyProgress] = useState("");
  const [gearProficiencyMax, setGearProficiencyMax] = useState("");
  const [gearMinorAttrCount, setGearMinorAttrCount] = useState<0 | 1 | 2>(0);
  const [gearMinorAttr1Name, setGearMinorAttr1Name] = useState<(typeof GEAR_MINOR_ATTRIBUTE_OPTIONS)[number] | "">("");
  const [gearMinorAttr1Value, setGearMinorAttr1Value] = useState("");
  const [gearMinorAttr2Name, setGearMinorAttr2Name] = useState<(typeof GEAR_MINOR_ATTRIBUTE_OPTIONS)[number] | "">("");
  const [gearMinorAttr2Value, setGearMinorAttr2Value] = useState("");
  const [gearModCount, setGearModCount] = useState<0 | 1 | 2>(0);
  const [gearMod1, setGearMod1] = useState("");
  const [gearMod1Value, setGearMod1Value] = useState("");
  const [gearMod2, setGearMod2] = useState("");
  const [gearMod2Value, setGearMod2Value] = useState("");
  const [weaponClass, setWeaponClass] = useState("AR");
  const [coreColor, setCoreColor] = useState("");
  const [coreCount, setCoreCount] = useState("1");
  const [talentId, setTalentId] = useState("");
  const [talentText, setTalentText] = useState("");
  const [talentSearch, setTalentSearch] = useState("");
  const [modSlots, setModSlots] = useState("");
  const [wikiUrl, setWikiUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetLootRef, setTargetLootRef] = useState("");
  const [notes, setNotes] = useState("");
  const [attributeCategory, setAttributeCategory] = useState("");
  const [talentType, setTalentType] = useState("");
  const [description, setDescription] = useState("");
  const [acquisition, setAcquisition] = useState("");
  const [weaponTotalDamage, setWeaponTotalDamage] = useState("");
  const [weaponBaseDamage, setWeaponBaseDamage] = useState("");
  const [weaponRpm, setWeaponRpm] = useState("");
  const [weaponMagSize, setWeaponMagSize] = useState("");
  const [weaponDpm, setWeaponDpm] = useState("");
  const [weaponPnt, setWeaponPnt] = useState("");
  const [weaponOptimalRange, setWeaponOptimalRange] = useState("");
  const [weaponHeadshotPct, setWeaponHeadshotPct] = useState("");
  const [weaponExpertise, setWeaponExpertise] = useState("");
  const [weaponCoreAttribute, setWeaponCoreAttribute] = useState("");
  const [weaponAttribute, setWeaponAttribute] = useState("");
  const [weaponModMag, setWeaponModMag] = useState("");
  const [weaponModScope, setWeaponModScope] = useState("");
  const [weaponModMuzzle, setWeaponModMuzzle] = useState("");
  const [weaponModUnderbarrel, setWeaponModUnderbarrel] = useState("");
  const [detailEntries, setDetailEntries] = useState("");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLoad, setLoadingLoad] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [openStep, setOpenStep] = useState<GearStep | null>("basic");
  const [openWeaponStep, setOpenWeaponStep] = useState<WeaponStep | null>("basic");
  const draftHydrated = useRef(false);
  const prevTypeRef = useRef<ItemType>("gear");
  const gearSharedRef = useRef<any>(null);
  const weaponSharedRef = useRef<any>(null);

  // Create talent flow (type a name that doesn't exist -> create + describe).
  const [createTalentOpen, setCreateTalentOpen] = useState(false);
  const [createTalentName, setCreateTalentName] = useState("");
  const [createTalentType, setCreateTalentType] = useState<string>("Weapon");
  const [createTalentDesc, setCreateTalentDesc] = useState("");
  const [createTalentWikiUrl, setCreateTalentWikiUrl] = useState("");
  const [createTalentErr, setCreateTalentErr] = useState<string | null>(null);
  const [createTalentLoading, setCreateTalentLoading] = useState(false);

  useEffect(() => {
    try {
      const metaRaw = localStorage.getItem(DRAFT_META_KEY);
      const metaType: ItemType = metaRaw
        ? (() => {
            try {
              const meta = JSON.parse(metaRaw);
              return meta?.type === "weapon" ? "weapon" : "gear";
            } catch {
              return "gear";
            }
          })()
        : "gear";
      if (metaType === "weapon") setType("weapon");

      // Prefer new per-type drafts; fall back to legacy key once.
      const legacyRaw = localStorage.getItem(LEGACY_DRAFT_KEY);
      const raw =
        localStorage.getItem(metaType === "weapon" ? DRAFT_WEAPON_KEY : DRAFT_GEAR_KEY) ??
        legacyRaw ??
        null;
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      setType(d.type === "weapon" ? "weapon" : "gear");
      setGearFormMode(d.gearFormMode === "advanced" ? "advanced" : "quick");
      setWeaponFormMode(d.weaponFormMode === "advanced" ? "advanced" : "quick");
      setMode(d.mode === "update" ? "update" : "create");
      setItemId(String(d.id ?? ""));
      setName(String(d.name ?? ""));
      setRarity(String(d.rarity ?? "HighEnd"));
      setSlot(String(d.slot ?? "Mask"));
      setBrandId(String(d.brandId ?? ""));
      setSetId(String(d.setId ?? ""));
      setGearSetName(String(d.gearSetName ?? ""));
      setBelongsToGearSet(Boolean(d.belongsToGearSet ?? false));
      setGearCoreAttrName((d.gearCoreAttrName ?? "") as any);
      setGearCoreAttrValue(String(d.gearCoreAttrValue ?? ""));
      setGearArmorValue(String(d.gearArmorValue ?? ""));
      setGearProficiencyRank(String(d.gearProficiencyRank ?? ""));
      setGearProficiencyProgress(String(d.gearProficiencyProgress ?? ""));
      setGearProficiencyMax(String(d.gearProficiencyMax ?? ""));
      setGearMinorAttrCount((Number(d.gearMinorAttrCount ?? 0) as any) || 0);
      setGearMinorAttr1Name((d.gearMinorAttr1Name ?? "") as any);
      setGearMinorAttr1Value(String(d.gearMinorAttr1Value ?? ""));
      setGearMinorAttr2Name((d.gearMinorAttr2Name ?? "") as any);
      setGearMinorAttr2Value(String(d.gearMinorAttr2Value ?? ""));
      setGearModCount((Number(d.gearModCount ?? 0) as any) || 0);
      setGearMod1(String(d.gearMod1 ?? ""));
      setGearMod1Value(String(d.gearMod1Value ?? ""));
      setGearMod2(String(d.gearMod2 ?? ""));
      setGearMod2Value(String(d.gearMod2Value ?? ""));
      setWeaponClass(String(d.weaponClass ?? "AR"));
      setWeaponTotalDamage(String(d.weaponTotalDamage ?? ""));
      setWeaponBaseDamage(String(d.weaponBaseDamage ?? ""));
      setWeaponRpm(String(d.weaponRpm ?? ""));
      setWeaponMagSize(String(d.weaponMagSize ?? ""));
      setWeaponDpm(String(d.weaponDpm ?? ""));
      setWeaponPnt(String(d.weaponPnt ?? ""));
      setWeaponOptimalRange(String(d.weaponOptimalRange ?? ""));
      setWeaponHeadshotPct(String(d.weaponHeadshotPct ?? ""));
      setWeaponExpertise(String(d.weaponExpertise ?? ""));
      setWeaponCoreAttribute(String(d.weaponCoreAttribute ?? ""));
      setWeaponAttribute(String(d.weaponAttribute ?? ""));
      setWeaponModMag(String(d.weaponModMag ?? ""));
      setWeaponModScope(String(d.weaponModScope ?? ""));
      setWeaponModMuzzle(String(d.weaponModMuzzle ?? ""));
      setWeaponModUnderbarrel(String(d.weaponModUnderbarrel ?? ""));
      setCoreColor(String(d.coreColor ?? ""));
      setCoreCount(String(d.coreCount ?? "1"));
      setTalentId(String(d.talentId ?? ""));
      setTalentText(String(d.talentText ?? ""));
      setModSlots(String(d.modSlots ?? ""));
      setWikiUrl(String(d.wikiUrl ?? ""));
      setImageUrl(String(d.imageUrl ?? ""));
      setTargetLootRef(String(d.targetLootRef ?? ""));
      setNotes(String(d.notes ?? ""));
      setAttributeCategory(String(d.attributeCategory ?? ""));
      setTalentType(String(d.talentType ?? ""));
      setDescription(String(d.description ?? ""));
      setAcquisition(String(d.acquisition ?? ""));
      setDetailEntries(String(d.detailEntries ?? ""));
      setOpenStep((d.openStep ?? "basic") as any);
      setOpenWeaponStep((d.openWeaponStep ?? "basic") as any);

      // Split legacy draft into per-type keys so switching doesn't overwrite values.
      if (legacyRaw) {
        localStorage.setItem(DRAFT_META_KEY, JSON.stringify({ type: d.type === "weapon" ? "weapon" : "gear" }));
        localStorage.setItem(d.type === "weapon" ? DRAFT_WEAPON_KEY : DRAFT_GEAR_KEY, legacyRaw);
        localStorage.removeItem(LEGACY_DRAFT_KEY);
      }
    } catch {
      // ignore draft errors
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const t = window.setTimeout(() => {
      const draft: any = {
        version: 1,
        type,
        gearFormMode,
        weaponFormMode,
        mode,
        id,
        name,
        rarity,
        slot,
        brandId,
        setId,
        gearSetName,
        belongsToGearSet,
        gearCoreAttrName,
        gearCoreAttrValue,
        gearArmorValue,
        gearProficiencyRank,
        gearProficiencyProgress,
        gearProficiencyMax,
        gearMinorAttrCount,
        gearMinorAttr1Name,
        gearMinorAttr1Value,
        gearMinorAttr2Name,
        gearMinorAttr2Value,
        gearModCount,
        gearMod1,
        gearMod1Value,
        gearMod2,
        gearMod2Value,
        weaponClass,
        weaponTotalDamage,
        weaponBaseDamage,
        weaponRpm,
        weaponMagSize,
        weaponDpm,
        weaponPnt,
        weaponOptimalRange,
        weaponHeadshotPct,
        weaponExpertise,
        weaponCoreAttribute,
        weaponAttribute,
        weaponModMag,
        weaponModScope,
        weaponModMuzzle,
        weaponModUnderbarrel,
        coreColor,
        coreCount,
        talentId,
        talentText,
        modSlots,
        wikiUrl,
        imageUrl,
        targetLootRef,
        notes,
        attributeCategory,
        talentType,
        description,
        acquisition,
        detailEntries,
        openStep,
        openWeaponStep,
      };
      localStorage.setItem(DRAFT_META_KEY, JSON.stringify({ type }));
      localStorage.setItem(type === "weapon" ? DRAFT_WEAPON_KEY : DRAFT_GEAR_KEY, JSON.stringify(draft));
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    type,
    gearFormMode,
    weaponFormMode,
    mode,
    id,
    name,
    rarity,
    slot,
    brandId,
    setId,
    gearSetName,
    belongsToGearSet,
    gearCoreAttrName,
    gearCoreAttrValue,
    gearArmorValue,
    gearProficiencyRank,
    gearProficiencyProgress,
    gearProficiencyMax,
    gearMinorAttrCount,
    gearMinorAttr1Name,
    gearMinorAttr1Value,
    gearMinorAttr2Name,
    gearMinorAttr2Value,
    gearModCount,
    gearMod1,
    gearMod1Value,
    gearMod2,
    gearMod2Value,
    weaponClass,
    weaponTotalDamage,
    weaponBaseDamage,
    weaponRpm,
    weaponMagSize,
    weaponDpm,
    weaponPnt,
    weaponOptimalRange,
    weaponHeadshotPct,
    weaponExpertise,
    weaponCoreAttribute,
    weaponAttribute,
    weaponModMag,
    weaponModScope,
    weaponModMuzzle,
    weaponModUnderbarrel,
    coreColor,
    coreCount,
    talentId,
    talentText,
    modSlots,
    wikiUrl,
    imageUrl,
    targetLootRef,
    notes,
    attributeCategory,
    talentType,
    description,
    acquisition,
    detailEntries,
    openStep,
    openWeaponStep,
  ]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_META_KEY);
    localStorage.removeItem(DRAFT_GEAR_KEY);
    localStorage.removeItem(DRAFT_WEAPON_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
    // Clear immediately: the page has a lot of derived state/hydration guards,
    // so a hard reload is the most reliable way to fully reset the editor.
    window.location.reload();
  };

  const readDetailValue = (model: any, group: string, key: string): string => {
    const entries: DetailEntry[] = Array.isArray(model?.detailEntries) ? model.detailEntries : [];
    const v = entries.find((e) => String(e?.group ?? "") === group && String(e?.key ?? "") === key)?.value;
    return String(v ?? "").trim();
  };

  const prettyDetailsJson = (model: any): string => {
    const entries = Array.isArray(model?.detailEntries) ? model.detailEntries : [];
    if (!entries.length) return "";
    try {
      return JSON.stringify(entries, null, 2);
    } catch {
      return "";
    }
  };

  const loadExistingById = async () => {
    try {
      const itemId = id.trim();
      if (!itemId) throw new Error("ID is required.");
      setErr(null);
      setResult(null);
      setLoadingLoad(true);
      if (type === "gear") {
        const data: any = await apiGet<any>(`/catalog/gear-items/${itemId}`);
        setName(String(data?.name ?? ""));
        setRarity(String(data?.rarity ?? "HighEnd"));
        setSlot(String(data?.slot ?? "Mask"));
        setBrandId(String(data?.brandId ?? ""));
        setSetId(String(data?.setId ?? ""));
        setBelongsToGearSet(Boolean(String(data?.rarity ?? "") === "GearSet"));
        setGearSetName(String(data?.gearSet?.name ?? ""));
        setCoreColor(String(data?.coreColor ?? ""));
        setCoreCount(String(data?.coreCount ?? "1"));
        setModSlots(String(data?.modSlots ?? ""));

        const coreStat = Array.isArray(data?.stats) ? data.stats.find((s: any) => s?.kind === "core") : null;
        if (coreStat?.name) setGearCoreAttrName(coreStat.name);
        if (coreStat?.value !== undefined) setGearCoreAttrValue(String(coreStat.value ?? ""));

        const minors = (Array.isArray(data?.stats) ? data.stats.filter((s: any) => s?.kind === "minor") : []).slice(0, 2);
        setGearMinorAttrCount((minors.length as any) ?? 0);
        setGearMinorAttr1Name((minors[0]?.name ?? "") as any);
        setGearMinorAttr1Value(String(minors[0]?.value ?? ""));
        setGearMinorAttr2Name((minors[1]?.name ?? "") as any);
        setGearMinorAttr2Value(String(minors[1]?.value ?? ""));

        const mods = (Array.isArray(data?.mods) ? data.mods : []).slice(0, 2);
        setGearModCount((mods.length as any) ?? 0);
        setGearMod1(String(mods[0]?.name ?? ""));
        setGearMod1Value(String(mods[0]?.value ?? ""));
        setGearMod2(String(mods[1]?.name ?? ""));
        setGearMod2Value(String(mods[1]?.value ?? ""));

        const dm = data?.detailModel;
        setDescription(String(dm?.description ?? ""));
        setAcquisition(String(dm?.acquisition ?? ""));
        setGearArmorValue(readDetailValue(dm, "gear_header", "ArmorValue"));
        setGearProficiencyRank(readDetailValue(dm, "gear_proficiency", "ProficiencyRank"));
        setGearProficiencyProgress(readDetailValue(dm, "gear_proficiency", "ProficiencyProgress"));
        setGearProficiencyMax(readDetailValue(dm, "gear_proficiency", "ProficiencyMax"));

        setTalentId(String(data?.talentId ?? data?.talent?.id ?? ""));
        setTalentText(String(data?.talent?.name ?? ""));

        setWikiUrl(String(data?.wikiUrl ?? ""));
        setImageUrl(String(data?.imageUrl ?? ""));
        setTargetLootRef(String(data?.targetLootRef ?? ""));
        setNotes(String(data?.notes ?? ""));

        if (gearFormMode === "advanced") setDetailEntries(prettyDetailsJson(dm));
      } else {
        const data: any = await apiGet<any>(`/catalog/weapons/${itemId}`);
        setName(String(data?.name ?? ""));
        setRarity(String(data?.rarity ?? "HighEnd"));
        setWeaponClass(String(data?.class ?? "AR"));

        setWeaponBaseDamage(String(data?.baseDamage ?? ""));
        setWeaponRpm(String(data?.rpm ?? ""));
        setWeaponMagSize(String(data?.magSize ?? ""));

        const dm = data?.detailModel;
        setDescription(String(dm?.description ?? ""));
        setAcquisition(String(dm?.acquisition ?? ""));
        setWeaponTotalDamage(readDetailValue(dm, "weapon_stats", "TotalDamage"));
        setWeaponDpm(readDetailValue(dm, "weapon_stats", "DPM"));
        setWeaponPnt(readDetailValue(dm, "weapon_stats", "PNT"));
        setWeaponOptimalRange(readDetailValue(dm, "weapon_stats", "OptimalRange"));
        setWeaponHeadshotPct(readDetailValue(dm, "weapon_stats", "HeadshotDamagePct"));

        setWeaponExpertise(readDetailValue(dm, "weapon_config", "Pericia"));
        setWeaponCoreAttribute(readDetailValue(dm, "weapon_config", "AtributoCentral"));
        setWeaponAttribute(readDetailValue(dm, "weapon_config", "Atributo"));

        setWeaponModMag(readDetailValue(dm, "weapon_mods", "Mod_Pente"));
        setWeaponModScope(readDetailValue(dm, "weapon_mods", "Mod_Mira"));
        setWeaponModMuzzle(readDetailValue(dm, "weapon_mods", "Mod_Bocal"));
        setWeaponModUnderbarrel(readDetailValue(dm, "weapon_mods", "Mod_SuporteInferior"));

        setTalentId(String(data?.talentId ?? data?.talent?.id ?? ""));
        setTalentText(String(data?.talent?.name ?? ""));

        setWikiUrl(String(data?.wikiUrl ?? ""));
        setImageUrl(String(data?.imageUrl ?? ""));
        setTargetLootRef(String(data?.targetLootRef ?? ""));
        setNotes(String(data?.notes ?? ""));

        if (weaponFormMode === "advanced") setDetailEntries(prettyDetailsJson(dm));
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoadingLoad(false);
    }
  };

  // Keep shared fields independent between Gear and Weapon so switching types doesn't mix data.
  useEffect(() => {
    if (!draftHydrated.current) return;
    const prev = prevTypeRef.current;
    if (prev === type) return;
    const shared = {
      talentId,
      talentText,
      attributeCategory,
      talentType,
      description,
      acquisition,
      wikiUrl,
      imageUrl,
      targetLootRef,
      notes,
      detailEntries,
      modSlots,
    };
    if (prev === "gear") gearSharedRef.current = shared;
    else weaponSharedRef.current = shared;

    const nextShared = type === "gear" ? gearSharedRef.current : weaponSharedRef.current;
    if (nextShared) {
      setTalentId(String(nextShared.talentId ?? ""));
      setTalentText(String(nextShared.talentText ?? ""));
      setAttributeCategory(String(nextShared.attributeCategory ?? ""));
      setTalentType(String(nextShared.talentType ?? ""));
      setDescription(String(nextShared.description ?? ""));
      setAcquisition(String(nextShared.acquisition ?? ""));
      setWikiUrl(String(nextShared.wikiUrl ?? ""));
      setImageUrl(String(nextShared.imageUrl ?? ""));
      setTargetLootRef(String(nextShared.targetLootRef ?? ""));
      setNotes(String(nextShared.notes ?? ""));
      setDetailEntries(String(nextShared.detailEntries ?? ""));
      setModSlots(String(nextShared.modSlots ?? ""));
    } else {
      setTalentId("");
      setTalentText("");
      setAttributeCategory("");
      setTalentType("");
      setDescription("");
      setAcquisition("");
      setWikiUrl("");
      setImageUrl("");
      setTargetLootRef("");
      setNotes("");
      setDetailEntries("");
      setModSlots("");
    }
    prevTypeRef.current = type;
  }, [
    type,
    talentId,
    talentText,
    attributeCategory,
    talentType,
    description,
    acquisition,
    wikiUrl,
    imageUrl,
    targetLootRef,
    notes,
    detailEntries,
    modSlots,
  ]);

  const stepRefs = {
    basic: useRef<HTMLDivElement | null>(null),
    brandset: useRef<HTMLDivElement | null>(null),
    core: useRef<HTMLDivElement | null>(null),
    prof: useRef<HTMLDivElement | null>(null),
    attrs: useRef<HTMLDivElement | null>(null),
    mods: useRef<HTMLDivElement | null>(null),
    advanced: useRef<HTMLDivElement | null>(null),
  } as const;

  const weaponStepRefs = {
    basic: useRef<HTMLDivElement | null>(null),
    stats: useRef<HTMLDivElement | null>(null),
    attrs: useRef<HTMLDivElement | null>(null),
    mods: useRef<HTMLDivElement | null>(null),
    advanced: useRef<HTMLDivElement | null>(null),
  } as const;

  const headers = undefined;
  const brandsQuery = useQuery({
    queryKey: ["catalog-brands-for-admin"],
    queryFn: () => apiGet<BrandOption[]>("/catalog/brands"),
    enabled: type === "gear",
  });
  const setsQuery = useQuery({
    queryKey: ["catalog-gear-sets-for-admin"],
    queryFn: () => apiGet<GearSetOption[]>("/catalog/gear-sets"),
    enabled: type === "gear",
  });

  const effectiveTalentType = useMemo(() => {
    if (type === "weapon") return "Weapon";
    if (talentType) return talentType;
    if (rarity === "GearSet") return "GearSet";
    if (slot === "Chest") return "Chest";
    if (slot === "Backpack") return "Backpack";
    return "";
  }, [type, talentType, rarity, slot]);

  useEffect(() => {
    const t = window.setTimeout(() => setTalentSearch(talentText.trim()), 200);
    return () => window.clearTimeout(t);
  }, [talentText]);
  const talentQueryString = useMemo(() => {
    const p = new URLSearchParams();
    if (effectiveTalentType) p.set("type", effectiveTalentType);
    const qq = talentSearch.trim();
    if (qq) p.set("q", qq);
    p.set("take", qq ? "50" : "200");
    return `?${p.toString()}`;
  }, [effectiveTalentType, talentSearch]);

  const talentsQuery = useQuery({
    queryKey: ["catalog-talents-for-admin", talentQueryString],
    queryFn: () => apiGet<TalentOption[]>(`/catalog/talents${talentQueryString}`),
  });
  const selectedBrand = brandsQuery.data?.find((b) => b.id === brandId) ?? null;
  const selectedSet = setsQuery.data?.find((s) => s.id === setId) ?? null;
  // selected talent name lookup can use the fetched page; ok if null.
  const selectedTalent = (talentsQuery.data ?? []).find((t) => t.id === talentId) ?? null;

  useEffect(() => {
    if (!selectedTalent) return;
    // Keep a nice label in the ComboBox input when talent was selected by ID (e.g. draft restore).
    setTalentText((cur) => (cur.trim() ? cur : selectedTalent.name));
  }, [selectedTalent?.id]);

  const talentOptions = useMemo(() => {
    const list = talentsQuery.data ?? [];
    return list.map((t) => ({
      id: t.id,
      label: t.name,
      keywords: `${t.id} ${t.type}`,
    }));
  }, [talentsQuery.data]);

  const openCreateTalent = (q: string) => {
    const name = String(q ?? "").trim();
    if (name.length < 2) return;
    setCreateTalentErr(null);
    setCreateTalentName(name);
    setCreateTalentType(effectiveTalentType || "Weapon");
    setCreateTalentDesc("");
    setCreateTalentWikiUrl("");
    setCreateTalentOpen(true);
  };

  const submitCreateTalent = async () => {
    try {
      const name = createTalentName.trim();
      if (name.length < 2) throw new Error(tx("Nome muito curto.", "Name is too short."));
      setCreateTalentErr(null);
      setCreateTalentLoading(true);
      const res = await apiPost<{ id: string; name: string; type: string }>("/admin/talents", {
        name,
        type: String(createTalentType || "Weapon"),
        description: createTalentDesc.trim() || undefined,
        wikiUrl: createTalentWikiUrl.trim() || undefined,
      });
      setTalentId(String(res?.id ?? ""));
      setTalentText(name);
      setCreateTalentOpen(false);
      await qc.invalidateQueries({ queryKey: ["catalog-talents-for-admin"] });
    } catch (e: any) {
      setCreateTalentErr(e?.message ?? String(e));
    } finally {
      setCreateTalentLoading(false);
    }
  };
  const selectedSetNamePreview = selectedSet?.name ?? (belongsToGearSet || rarity === "GearSet" ? gearSetName.trim() || null : null);
  const gearSetNameTrim = gearSetName.trim();
  const matchedGearSet =
    gearSetNameTrim && (setsQuery.data ?? []).length
      ? (setsQuery.data ?? []).find(
          (s) => s.name.toLowerCase() === gearSetNameTrim.toLowerCase() || s.id === gearSetNameTrim,
        ) ?? null
      : null;
  const gearCorePreview =
    type === "gear" && gearFormMode === "quick" && gearCoreAttrName
      ? `${gearCoreAttrName}${gearCoreAttrValue ? `: ${gearCoreAttrValue}` : ""}`
      : coreColor
        ? `${coreColor} x${coreCount || "1"}`
        : "-";
  const weaponModsPreview = [
    weaponModMag ? `Pente: ${weaponModMag}` : null,
    weaponModScope ? `Mira: ${weaponModScope}` : null,
    weaponModMuzzle ? `Bocal: ${weaponModMuzzle}` : null,
    weaponModUnderbarrel ? `Suporte: ${weaponModUnderbarrel}` : null,
  ].filter(Boolean) as string[];
  const brandBonusesPreview = selectedBrand
    ? [selectedBrand.bonus1, selectedBrand.bonus2, selectedBrand.bonus3].filter(Boolean) as string[]
    : [];
  const setBonusesPreview = selectedSet
    ? [selectedSet.bonus2, selectedSet.bonus3, selectedSet.bonus4].filter(Boolean) as string[]
    : [];

  const completion = {
    name: Boolean(name.trim()),
    slot: Boolean(slot),
    rarity: Boolean(rarity),
    brandOrSet: type !== "gear" ? true : rarity === "GearSet" ? Boolean(setId || gearSetName.trim()) : Boolean(brandId || setId),
    core: type !== "gear" ? true : gearFormMode === "quick" ? Boolean(gearCoreAttrName && gearCoreAttrValue.trim()) : Boolean(coreColor),
    attrs:
      type !== "gear"
        ? true
        : gearMinorAttrCount === 0
          ? true
          : gearMinorAttrCount === 1
            ? Boolean(gearMinorAttr1Name && gearMinorAttr1Value.trim())
            : Boolean(gearMinorAttr1Name && gearMinorAttr1Value.trim() && gearMinorAttr2Name && gearMinorAttr2Value.trim()),
    mods:
      type !== "gear"
        ? true
        : gearModCount === 0
          ? true
          : gearModCount === 1
            ? Boolean(gearMod1.trim() && gearMod1Value.trim())
            : Boolean(gearMod1.trim() && gearMod1Value.trim() && gearMod2.trim() && gearMod2Value.trim()),
  };

  const weaponCompletion = {
    basic: Boolean(name.trim() && rarity && weaponClass),
    stats: Boolean(
      weaponTotalDamage.trim() ||
      weaponBaseDamage.trim() ||
      weaponRpm.trim() ||
      weaponMagSize.trim() ||
      weaponDpm.trim() ||
      weaponPnt.trim() ||
      weaponOptimalRange.trim() ||
      weaponHeadshotPct.trim(),
    ),
    attrs: Boolean(weaponCoreAttribute.trim() || weaponAttribute.trim() || weaponExpertise.trim()),
    mods: Boolean(weaponModMag.trim() || weaponModScope.trim() || weaponModMuzzle.trim() || weaponModUnderbarrel.trim()),
  };

  const Chip = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`td2-badge ${ok ? "td2-badge--ok" : "td2-badge--muted"}`}>
      <span className="td2-badge__dot" />
      {label}
    </span>
  );

  const stepOrder = useMemo<GearStep[]>(
    () => (gearFormMode === "advanced" ? ["basic", "brandset", "core", "prof", "attrs", "mods", "advanced"] : ["basic", "brandset", "core", "prof", "attrs", "mods"]),
    [gearFormMode],
  );

  const weaponStepOrder = useMemo<WeaponStep[]>(
    () => (weaponFormMode === "advanced" ? ["basic", "stats", "attrs", "mods", "advanced"] : ["basic", "stats", "attrs", "mods"]),
    [weaponFormMode],
  );

  const stepOk: Record<GearStep, boolean> = useMemo(
    () => ({
      basic: completion.name && completion.slot && completion.rarity,
      brandset: completion.brandOrSet,
      core: completion.core,
      prof: true,
      attrs: completion.attrs,
      mods: completion.mods,
      advanced: true,
    }),
    [completion],
  );

  const nextMissingStep = useMemo(() => {
    if (type !== "gear") return null;
    for (const s of stepOrder) {
      if (!stepOk[s]) return s;
    }
    return null;
  }, [stepOk, stepOrder, type]);

  const weaponStepOk: Record<WeaponStep, boolean> = useMemo(
    () => ({
      basic: weaponCompletion.basic,
      stats: weaponCompletion.stats,
      attrs: weaponCompletion.attrs,
      mods: weaponCompletion.mods,
      advanced: true,
    }),
    [weaponCompletion],
  );

  const nextMissingWeaponStep = useMemo(() => {
    if (type !== "weapon") return null;
    // For weapons, only the "basic" step is required. Others are optional enrichment.
    return weaponStepOk.basic ? null : "basic";
  }, [type, weaponStepOk, weaponStepOrder]);

  useEffect(() => {
    if (type !== "gear") return;
    if (!nextMissingStep) return;
    // Don't auto-advance while the user is editing. Only open the next missing step
    // when everything is collapsed (openStep === null), so completed steps can be reopened.
    if (openStep === null) setOpenStep(nextMissingStep);
  }, [type, nextMissingStep, openStep, stepOk]);

  useEffect(() => {
    if (type !== "weapon") return;
    if (!nextMissingWeaponStep) return;
    if (openWeaponStep === null) setOpenWeaponStep(nextMissingWeaponStep);
  }, [type, nextMissingWeaponStep, openWeaponStep, weaponStepOk]);

  const gotoStep = (s: GearStep) => {
    setOpenStep(s);
    const el = stepRefs[s].current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const gotoWeaponStep = (s: WeaponStep) => {
    setOpenWeaponStep(s);
    const el = weaponStepRefs[s].current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async () => {
    try {
      if (mode === "update" && !id) throw new Error("ID is required.");
      if (mode === "create" && !name) {
        throw new Error("Name is required for create.");
      }

      setErr(null);
      setLoading(true);
      setResult(null);

      if (type === "gear" && gearFormMode === "quick" && mode === "create") {
        if ((belongsToGearSet || rarity === "GearSet") && !gearSetName.trim()) {
          throw new Error(tx("Informe o nome do Gear Set.", "Provide Gear Set name."));
        }
        if (!gearCoreAttrName) {
          throw new Error(tx("Selecione o atributo central.", "Select core attribute."));
        }
        if (!gearCoreAttrValue.trim()) {
          throw new Error(tx("Informe o valor do atributo central.", "Provide core attribute value."));
        }
        if (gearMinorAttrCount >= 1) {
          if (!gearMinorAttr1Name) throw new Error(tx("Selecione o Atributo 1.", "Select Attribute 1."));
          if (!gearMinorAttr1Value.trim()) throw new Error(tx("Informe o valor do Atributo 1.", "Provide Attribute 1 value."));
        }
        if (gearMinorAttrCount >= 2) {
          if (!gearMinorAttr2Name) throw new Error(tx("Selecione o Atributo 2.", "Select Attribute 2."));
          if (!gearMinorAttr2Value.trim()) throw new Error(tx("Informe o valor do Atributo 2.", "Provide Attribute 2 value."));
        }
        if (gearModCount >= 1) {
          if (!gearMod1.trim()) throw new Error(tx("Informe o Mod 1.", "Provide Mod 1."));
          if (!gearMod1Value.trim()) throw new Error(tx("Informe o valor do Mod 1.", "Provide Mod 1 value."));
        }
        if (gearModCount >= 2) {
          if (!gearMod2.trim()) throw new Error(tx("Informe o Mod 2.", "Provide Mod 2."));
          if (!gearMod2Value.trim()) throw new Error(tx("Informe o valor do Mod 2.", "Provide Mod 2 value."));
        }
      }

      if (type === "weapon") {
        if (weaponRpm.trim()) {
          const n = parseOptionalInt(weaponRpm, "rpm");
          if (!n || n <= 0) throw new Error("rpm must be an integer > 0.");
        }
        if (weaponMagSize.trim()) {
          const n = parseOptionalInt(weaponMagSize, "magSize");
          if (!n || n <= 0) throw new Error("magSize must be an integer > 0.");
        }
      }

      const payload: Record<string, any> = {};
      if (mode === "create" || name) payload.name = name;
      if (mode === "create" || rarity) payload.rarity = rarity;
      if (mode === "create" || description) payload.description = description || undefined;
      if (mode === "create" || acquisition) payload.acquisition = acquisition || undefined;
      if (type === "gear") {
        const brand = brandId.trim();
        const set = setId.trim();
        const setName = gearSetName.trim();
        const talent = talentId.trim();
        const wiki = wikiUrl.trim();
        const image = imageUrl.trim();
        const target = targetLootRef.trim();
        const freeNotes = notes.trim();
        const parsedCoreCount = parseOptionalInt(coreCount, "coreCount");
        const parsedModSlots = parseOptionalInt(modSlots, "modSlots");
        const guidedCoreColor =
          gearFormMode === "quick"
            ? gearCoreAttrName === "Weapon Damage"
              ? "Red"
              : gearCoreAttrName === "Armor"
                ? "Blue"
                : gearCoreAttrName === "Skill Tier"
                  ? "Yellow"
                  : ""
            : "";
        const guidedModSlots = gearFormMode === "quick" ? gearModCount : parsedModSlots;

        let effectiveSetId = set;
        if (rarity === "GearSet") {
          // Allow guided UI to use set name with autocomplete.
          if (!effectiveSetId && setName && setsQuery.data?.length) {
            const found = setsQuery.data.find((s) => s.name.toLowerCase() === setName.toLowerCase() || s.id === setName);
            if (found) {
              effectiveSetId = found.id;
              setSetId(found.id);
              setGearSetName(found.name);
            }
          }
          if (!effectiveSetId && setName) {
            // Create gear set on the fly if it doesn't exist yet.
            const created = await apiPost<{ id: string; name: string }>("/admin/gear-sets", { name: setName }, headers);
            if (created?.id) {
              effectiveSetId = created.id;
              setSetId(created.id);
              setGearSetName(created.name ?? setName);
              await qc.invalidateQueries({ queryKey: ["catalog-gear-sets-for-admin"] });
            }
          }
          if (!effectiveSetId) throw new Error(tx("Gear Set é obrigatório.", "Gear Set is required."));
          if (brand) throw new Error("brandId must be empty when rarity is GearSet.");
        }
        if (mode === "create" && rarity !== "Exotic" && !brand && !set) {
          throw new Error("For create, provide brandId or setId so brand/set summary works correctly.");
        }

        if (mode === "create" || slot) payload.slot = slot;
        if (guidedCoreColor) {
          payload.coreColor = guidedCoreColor;
          payload.coreCount = 1;
        } else if (coreColor) {
          payload.coreColor = coreColor;
          payload.coreCount = parsedCoreCount ?? 1;
        } else if (parsedCoreCount !== undefined) {
          payload.coreCount = parsedCoreCount;
        }
        if (rarity === "GearSet") {
          payload.setId = effectiveSetId;
        } else {
          if (brand) payload.brandId = brand;
          if (set) payload.setId = set;
        }
        if (guidedModSlots !== undefined) {
          payload.modSlots = guidedModSlots;
        }
        if (talent) payload.talentId = talent;
        if (gearFormMode === "advanced") {
          if (wiki) payload.wikiUrl = wiki;
          if (image) payload.imageUrl = image;
          if (target) payload.targetLootRef = target;
          if (freeNotes) payload.notes = freeNotes;
        }
      } else {
        if (mode === "create" || weaponClass) payload.class = weaponClass;
        const talent = talentId.trim();
        if (talent) payload.talentId = talent;
        if (weaponFormMode === "advanced") {
          const wiki = wikiUrl.trim();
          const image = imageUrl.trim();
          const target = targetLootRef.trim();
          const freeNotes = notes.trim();
          if (wiki) payload.wikiUrl = wiki;
          if (image) payload.imageUrl = image;
          if (target) payload.targetLootRef = target;
          if (freeNotes) payload.notes = freeNotes;
        }
        if (mode === "create" || weaponBaseDamage) payload.baseDamage = weaponBaseDamage.trim() || undefined;
        const parsedRpm = parseOptionalInt(weaponRpm, "rpm");
        const parsedMag = parseOptionalInt(weaponMagSize, "magSize");
        if (parsedRpm !== undefined) payload.rpm = parsedRpm;
        if (parsedMag !== undefined) payload.magSize = parsedMag;
      }
      // id is always auto-generated on create; ignore any client input

      const includeAdvancedDetails = type === "gear" ? gearFormMode === "advanced" : weaponFormMode === "advanced";
      const parsedDetails = includeAdvancedDetails ? (parseDetailEntries(detailEntries) ?? []) : [];
      const classificationDetails = [
        { key: "ItemType", value: type === "gear" ? "Gear" : "Weapon", group: "classification", order: 1 },
        includeAdvancedDetails && attributeCategory
          ? { key: "AttributeCategory", value: attributeCategory, group: "classification", order: 2 }
          : null,
        includeAdvancedDetails && talentType
          ? { key: "TalentType", value: talentType, group: "classification", order: 3 }
          : null,
      ].filter(Boolean);

      const gearGuidedDetails =
        type === "gear" && gearFormMode === "quick"
          ? [
              gearArmorValue
                ? { key: "ArmorValue", value: gearArmorValue, group: "gear_header", order: 1 }
                : null,
              gearProficiencyRank
                ? { key: "ProficiencyRank", value: gearProficiencyRank, group: "gear_proficiency", order: 1 }
                : null,
              gearProficiencyProgress
                ? { key: "ProficiencyProgress", value: gearProficiencyProgress, group: "gear_proficiency", order: 2 }
                : null,
              gearProficiencyMax
                ? { key: "ProficiencyMax", value: gearProficiencyMax, group: "gear_proficiency", order: 3 }
                : null,
              gearCoreAttrName
                ? { key: "CoreAttribute", value: gearCoreAttrName, group: "gear_core", order: 1 }
                : null,
              gearCoreAttrValue
                ? { key: "CoreValue", value: gearCoreAttrValue, group: "gear_core", order: 2 }
                : null,
              gearMinorAttrCount >= 1 && gearMinorAttr1Name
                ? { key: "Attr1Name", value: gearMinorAttr1Name, group: "gear_attrs", order: 1 }
                : null,
              gearMinorAttrCount >= 1 && gearMinorAttr1Value
                ? { key: "Attr1Value", value: gearMinorAttr1Value, group: "gear_attrs", order: 2 }
                : null,
              gearMinorAttrCount >= 2 && gearMinorAttr2Name
                ? { key: "Attr2Name", value: gearMinorAttr2Name, group: "gear_attrs", order: 3 }
                : null,
              gearMinorAttrCount >= 2 && gearMinorAttr2Value
                ? { key: "Attr2Value", value: gearMinorAttr2Value, group: "gear_attrs", order: 4 }
                : null,
              gearModCount >= 1 && gearMod1
                ? { key: "Mod1Name", value: gearMod1, group: "gear_mods", order: 1 }
                : null,
              gearModCount >= 1 && gearMod1Value
                ? { key: "Mod1Value", value: gearMod1Value, group: "gear_mods", order: 2 }
                : null,
              gearModCount >= 2 && gearMod2
                ? { key: "Mod2Name", value: gearMod2, group: "gear_mods", order: 3 }
                : null,
              gearModCount >= 2 && gearMod2Value
                ? { key: "Mod2Value", value: gearMod2Value, group: "gear_mods", order: 4 }
                : null,
            ].filter(Boolean)
          : [];
      const weaponSpecificDetails =
        type === "weapon"
          ? [
              weaponTotalDamage
                ? { key: "TotalDamage", value: weaponTotalDamage, group: "weapon_stats", order: 1 }
                : null,
              weaponDpm ? { key: "DPM", value: weaponDpm, group: "weapon_stats", order: 2 } : null,
              weaponPnt ? { key: "PNT", value: weaponPnt, group: "weapon_stats", order: 3 } : null,
              weaponOptimalRange
                ? { key: "OptimalRange", value: weaponOptimalRange, group: "weapon_stats", order: 4 }
                : null,
              weaponHeadshotPct
                ? { key: "HeadshotDamagePct", value: weaponHeadshotPct, group: "weapon_stats", order: 5 }
                : null,
              weaponExpertise
                ? { key: "Pericia", value: weaponExpertise, group: "weapon_config", order: 1 }
                : null,
              weaponCoreAttribute
                ? { key: "AtributoCentral", value: weaponCoreAttribute, group: "weapon_config", order: 2 }
                : null,
              weaponAttribute
                ? { key: "Atributo", value: weaponAttribute, group: "weapon_config", order: 3 }
                : null,
              weaponModMag
                ? { key: "Mod_Pente", value: weaponModMag, group: "weapon_mods", order: 1 }
                : null,
              weaponModScope
                ? { key: "Mod_Mira", value: weaponModScope, group: "weapon_mods", order: 2 }
                : null,
              weaponModMuzzle
                ? { key: "Mod_Bocal", value: weaponModMuzzle, group: "weapon_mods", order: 3 }
                : null,
              weaponModUnderbarrel
                ? { key: "Mod_SuporteInferior", value: weaponModUnderbarrel, group: "weapon_mods", order: 4 }
                : null,
            ].filter(Boolean)
          : [];
      const combinedDetails = [...parsedDetails, ...classificationDetails, ...gearGuidedDetails, ...weaponSpecificDetails];
      const hasDetails = combinedDetails.length > 0;
      const finalDetails = hasDetails ? combinedDetails : undefined;
      if (finalDetails !== undefined) payload.detailEntries = finalDetails;

      if (mode === "update" && !Object.keys(payload).length) {
        throw new Error("Provide at least one field to update.");
      }

      const path = type === "gear" ? "/admin/gear-items" : "/admin/weapons";
      const res: IdResponse =
        mode === "create"
          ? await apiPost<IdResponse>(path, payload, headers)
          : await apiPut<IdResponse>(`${path}/${id}`, payload, headers);
      setResult(res);
      if (mode === "create" && res?.id && typeof res.id === "string") setItemId(res.id);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    try {
      if (!deleteId) throw new Error("Delete ID is required.");
      setErr(null);
      setLoading(true);
      const path = type === "gear" ? `/admin/gear-items/${deleteId}` : `/admin/weapons/${deleteId}`;
      const res = await apiDelete(path, headers);
      setResult(res);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Itens", "Admin Items")}</div>
        <div className="text-xs td2-subheading">{tx("Criar/atualizar gear e armas com detalhes completos", "Create/update gear and weapons with full detail entries")}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,1fr)] gap-6 items-start">
      <section className="td2-card rounded-2xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="td2-heading text-sm font-medium">{tx("Editor", "Editor")}</div>
            <div className="text-xs td2-muted">
              {tx("IDs são gerados automaticamente. Preencha o básico e veja o card ao lado completar em tempo real.", "IDs are auto-generated. Fill the basics and watch the card update live.")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={clearDraft}
              className="td2-btn px-3 py-2 text-sm"
              title={tx("Limpa o rascunho salvo automaticamente (não apaga o banco).", "Clears the auto-saved draft (does not delete database).")}
            >
              {tx("Limpar rascunho", "Clear draft")}
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="td2-btn px-4 py-2 disabled:opacity-50 text-sm"
            >
              {loading ? tx("Salvando...", "Saving...") : mode === "create" ? tx("Criar", "Create") : tx("Atualizar", "Update")}
            </button>
          </div>
        </div>

        <div className="td2-panel rounded-2xl p-4 space-y-3">
          <div className={`grid grid-cols-1 ${mode === "update" ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as ItemType;
              setType(next);
              setSlot(next === "gear" ? "Mask" : slot);
              setWeaponClass(next === "weapon" ? "AR" : weaponClass);
              if (next === "weapon") setWeaponFormMode("quick");
            }}
            className="td2-select px-3 py-2 text-sm"
          >
            <option value="gear">{tx("Item de Gear", "Gear Item")}</option>
            <option value="weapon">{tx("Arma", "Weapon")}</option>
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "create" | "update")}
            className="td2-select px-3 py-2 text-sm"
          >
            <option value="create">{tx("Criar", "Create")}</option>
            <option value="update">{tx("Atualizar", "Update")}</option>
          </select>
          {mode === "update" ? (
            <>
              <input
                value={id}
                onChange={(e) => setItemId(e.target.value)}
                placeholder={tx("ID existente (obrigatório)", "Existing ID (required)")}
                className="td2-input px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="td2-btn px-3 py-2 text-sm"
                onClick={loadExistingById}
                disabled={loadingLoad || !id.trim()}
                title={tx("Carrega os dados existentes para editar.", "Loads existing data for editing.")}
              >
                {loadingLoad ? tx("Carregando...", "Loading...") : tx("Carregar", "Load")}
              </button>
            </>
          ) : null}
        </div>

        {type === "gear" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip ok={completion.name} label={tx("Nome", "Name")} />
              <Chip ok={completion.slot} label={tx("Slot", "Slot")} />
              <Chip ok={completion.rarity} label={tx("Raridade", "Rarity")} />
              <Chip ok={completion.brandOrSet} label={tx("Marca/Set", "Brand/Set")} />
              <Chip ok={completion.core} label={tx("Central", "Core")} />
              <Chip ok={completion.attrs} label={tx("Atributos", "Attributes")} />
              <Chip ok={completion.mods} label={tx("Mods", "Mods")} />
            </div>

            <div className="td2-stepnav">
              {stepOrder.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`td2-stepbtn ${openStep === s ? "td2-stepbtn--active" : ""}`}
                  onClick={() => gotoStep(s)}
                >
                  {s === "basic" ? tx("Básico", "Basic") :
                   s === "brandset" ? tx("Marca/Set", "Brand/Set") :
                   s === "core" ? tx("Central", "Core") :
                   s === "prof" ? tx("Proficiência", "Proficiency") :
                   s === "attrs" ? tx("Atributos", "Attributes") :
                   s === "mods" ? tx("Mods", "Mods") :
                   tx("Avançado", "Advanced")}
                </button>
              ))}
              {nextMissingStep ? (
                <button type="button" className="td2-stepbtn" onClick={() => gotoStep(nextMissingStep)}>
                  {tx("Ir para o que falta", "Go to missing")}
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <GearAcc
                step="basic"
                title={tx("Básico", "Basic")}
                summary={`${name?.trim() ? name.trim() : tx("Nome", "Name")} · ${slot || tx("Slot", "Slot")} · ${rarity || tx("Raridade", "Rarity")}`}
                innerRef={stepRefs.basic}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={gearFormMode}
                    onChange={(e) => setGearFormMode(e.target.value as GearFormMode)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    <option value="quick">{tx("Adição Rápida (MVP)", "Quick Add (MVP)")}</option>
                    <option value="advanced">{tx("Avançado", "Advanced")}</option>
                  </select>
                  <div className="md:col-span-3 text-xs td2-muted self-center">
                    {tx("MVP: nome, slot, raridade, marca/set, atributo central, atributos e mods.", "MVP: name, slot, rarity, brand/set, core attribute, attributes and mods.")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={mode === "create" ? tx("Nome (obrigatório)", "Name (required)") : tx("Nome (opcional)", "Name (optional)")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <select
                    value={rarity}
                    onChange={(e) => setRarity(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {RARITY_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {SLOT_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>

                {gearFormMode === "quick" && (slot === "Chest" || slot === "Backpack") ? (
                  <div className="mt-3">
                    <ComboBox
                      value={talentText}
                      onChange={(next) => {
                        setTalentText(next);
                        const q = next.trim().toLowerCase();
                        const found = (talentsQuery.data ?? []).find((t) => t.name.toLowerCase() === q || t.id.toLowerCase() === q);
                        setTalentId(found?.id ?? "");
                      }}
                      onPick={(opt) => {
                        setTalentText(opt.label);
                        setTalentId(opt.id);
                      }}
                      options={talentOptions}
                      placeholder={tx("Talento (opcional)", "Talent (optional)")}
                      className="td2-input px-3 py-2 text-sm w-full"
                      disabled={talentsQuery.isLoading}
                      allowCreate
                      createLabel={(q) => tx(`Criar talento: "${q}"`, `Create talent: "${q}"`)}
                      onCreate={openCreateTalent}
                    />
                    <div className="text-[11px] td2-muted mt-1">
                      {tx("Talentos geralmente aparecem em Chest/Backpack (named/exotic).", "Talents usually apply to Chest/Backpack (named/exotic).")}
                    </div>
                  </div>
                ) : null}
              </GearAcc>

              <GearAcc
                step="brandset"
                title={tx("Marca / Set", "Brand / Set")}
                summary={
                  (belongsToGearSet || rarity === "GearSet")
                    ? (gearSetNameTrim || tx("Gear Set", "Gear Set"))
                    : (selectedBrand?.name || (brandId ? brandId : tx("Marca", "Brand")))
                }
                innerRef={stepRefs.brandset}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <label className="flex items-center gap-2 text-sm td2-muted">
                  <input
                    type="checkbox"
                    checked={belongsToGearSet || rarity === "GearSet"}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBelongsToGearSet(checked);
                      if (checked) {
                        setRarity("GearSet");
                        setBrandId("");
                      } else {
                        setSetId("");
                        setGearSetName("");
                        if (rarity === "GearSet") setRarity("HighEnd");
                      }
                    }}
                  />
                  {tx("Faz parte de Gear Set (verde)", "Belongs to a Gear Set (green)")}
                </label>

                <div className="mt-3">
                  {belongsToGearSet || rarity === "GearSet" ? (
                    <>
                      <ComboBox
                        value={gearSetName}
                        onChange={(next) => {
                          setGearSetName(next);
                          const found = setsQuery.data?.find((s) => s.name.toLowerCase() === next.trim().toLowerCase());
                          setSetId(found?.id ?? "");
                        }}
                        options={(setsQuery.data ?? []).map((s) => ({ id: s.id, label: s.name, keywords: s.id }))}
                        placeholder={tx("Nome do Gear Set (obrigatório)", "Gear Set name (required)")}
                        className="td2-input px-3 py-2 text-sm w-full"
                        allowCreate
                        createLabel={(q) => tx(`Criar novo set: "${q}"`, `Create new set: \"${q}\"`)}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {gearSetNameTrim ? (
                          matchedGearSet ? (
                            <span className="td2-badge td2-badge--ok">
                              <span className="td2-badge__dot" />
                              {tx("Set existente", "Existing set")}
                            </span>
                          ) : (
                            <span className="td2-badge td2-badge--warn">
                              <span className="td2-badge__dot" />
                              {tx("Vai criar novo set", "Will create new set")}
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] td2-muted">
                            {tx("Digite para buscar ou criar.", "Type to search or create.")}
                          </span>
                        )}
                        <span className="text-[11px] td2-muted">
                          {tx("Ao salvar, cria se não existir.", "On save, creates if missing.")}
                        </span>
                      </div>
                    </>
                  ) : brandsQuery.data?.length ? (
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="td2-select px-3 py-2 text-sm w-full"
                    >
                      <option value="">{tx("Conjunto de marca (opcional)", "Brand set (optional)")}</option>
                      {brandsQuery.data.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      placeholder={tx("brandId (opcional)", "brandId (optional)")}
                      className="td2-input px-3 py-2 text-sm w-full"
                    />
                  )}
                </div>
              </GearAcc>

              <GearAcc
                step="core"
                title={tx("Atributo Central", "Core Attribute")}
                summary={gearCoreAttrName ? `${gearCoreAttrName}${gearCoreAttrValue ? `: ${gearCoreAttrValue}` : ""}` : tx("Selecione o atributo central", "Select core attribute")}
                innerRef={stepRefs.core}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={gearCoreAttrName}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setGearCoreAttrName(v);
                      const nextColor =
                        v === "Weapon Damage" ? "Red" :
                        v === "Armor" ? "Blue" :
                        v === "Skill Tier" ? "Yellow" :
                        "";
                      setCoreColor(nextColor);
                      if (nextColor) setCoreCount("1");
                    }}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {GEAR_CORE_ATTRIBUTE_OPTIONS.map((x) => (
                      <option key={x || "none"} value={x}>{x || tx("Atributo central (obrigatório)", "Core attribute (required)")}</option>
                    ))}
                  </select>
                  <input
                    value={gearCoreAttrValue}
                    onChange={(e) => setGearCoreAttrValue(e.target.value)}
                    placeholder={tx("Valor (ex: 170000 | 1 | 15%)", "Value (e.g. 170000 | 1 | 15%)")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="text-xs td2-muted mt-2">
                  {tx("Cores: Dano de arma = Vermelho, Proteção/Armadura = Azul, Tier de habilidade = Amarelo.", "Colors: Weapon Damage = Red, Armor = Blue, Skill Tier = Yellow.")}
                </div>
              </GearAcc>

              <GearAcc
                step="prof"
                title={tx("Proteção / Proficiência", "Armor / Proficiency")}
                summary={
                  (gearArmorValue?.trim() ? `${gearArmorValue.trim()} ${tx("Proteção", "Armor")}` : tx("Opcional", "Optional")) +
                  (gearProficiencyRank?.trim() ? ` · ${tx("Rank", "Rank")} ${gearProficiencyRank.trim()}` : "")
                }
                innerRef={stepRefs.prof}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={gearArmorValue}
                    onChange={(e) => setGearArmorValue(e.target.value)}
                    placeholder={tx("Proteção do item (ex: 80k)", "Item armor (e.g. 80k)")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={gearProficiencyRank}
                      onChange={(e) => setGearProficiencyRank(e.target.value)}
                      placeholder={tx("Rank", "Rank")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={gearProficiencyProgress}
                      onChange={(e) => setGearProficiencyProgress(e.target.value)}
                      placeholder={tx("Progresso", "Progress")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={gearProficiencyMax}
                      onChange={(e) => setGearProficiencyMax(e.target.value)}
                      placeholder={tx("Máx", "Max")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </GearAcc>

              <GearAcc
                step="attrs"
                title={tx("Atributos", "Attributes")}
                summary={tx(`Quantidade: ${gearMinorAttrCount}`, `Count: ${gearMinorAttrCount}`)}
                innerRef={stepRefs.attrs}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={String(gearMinorAttrCount)}
                    onChange={(e) => {
                      const n = Number(e.target.value) as 0 | 1 | 2;
                      setGearMinorAttrCount(n);
                      if (n < 2) {
                        setGearMinorAttr2Name("");
                        setGearMinorAttr2Value("");
                      }
                      if (n < 1) {
                        setGearMinorAttr1Name("");
                        setGearMinorAttr1Value("");
                      }
                    }}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    <option value="0">{tx("Quantidade: 0", "Count: 0")}</option>
                    <option value="1">{tx("Quantidade: 1", "Count: 1")}</option>
                    <option value="2">{tx("Quantidade: 2", "Count: 2")}</option>
                  </select>

                  {gearMinorAttrCount >= 1 ? (
                    <select value={gearMinorAttr1Name} onChange={(e) => setGearMinorAttr1Name(e.target.value as any)} className="td2-select px-3 py-2 text-sm">
                      {GEAR_MINOR_ATTRIBUTE_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Atributo 1", "Attribute 1")}</option>
                      ))}
                    </select>
                  ) : null}
                  {gearMinorAttrCount >= 1 ? (
                    <input value={gearMinorAttr1Value} onChange={(e) => setGearMinorAttr1Value(e.target.value)} placeholder={tx("Valor 1 (ex: 12% | 170000)", "Value 1 (e.g. 12% | 170000)")} className="td2-input px-3 py-2 text-sm" />
                  ) : null}
                </div>

                {gearMinorAttrCount >= 2 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <select value={gearMinorAttr2Name} onChange={(e) => setGearMinorAttr2Name(e.target.value as any)} className="td2-select px-3 py-2 text-sm">
                      {GEAR_MINOR_ATTRIBUTE_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Atributo 2", "Attribute 2")}</option>
                      ))}
                    </select>
                    <input value={gearMinorAttr2Value} onChange={(e) => setGearMinorAttr2Value(e.target.value)} placeholder={tx("Valor 2", "Value 2")} className="td2-input px-3 py-2 text-sm" />
                  </div>
                ) : null}
              </GearAcc>

              <GearAcc
                step="mods"
                title={tx("Mods", "Mods")}
                summary={tx(`Quantidade: ${gearModCount}`, `Count: ${gearModCount}`)}
                innerRef={stepRefs.mods}
                openStep={openStep}
                setOpenStep={setOpenStep}
                stepOk={stepOk}
                stepOrder={stepOrder}
                nextMissingStep={nextMissingStep}
                gotoStep={gotoStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={String(gearModCount)}
                    onChange={(e) => {
                      const n = Number(e.target.value) as 0 | 1 | 2;
                      setGearModCount(n);
                      setModSlots(String(n));
                      if (n < 2) {
                        setGearMod2("");
                        setGearMod2Value("");
                      }
                      if (n < 1) {
                        setGearMod1("");
                        setGearMod1Value("");
                      }
                    }}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {GEAR_MOD_SLOT_OPTIONS.map((x) => (
                      <option key={x} value={x}>{tx(`Quantidade: ${x}`, `Count: ${x}`)}</option>
                    ))}
                  </select>
                  {gearModCount >= 1 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:col-span-2">
                      <input value={gearMod1} onChange={(e) => setGearMod1(e.target.value)} placeholder={tx("Mod 1", "Mod 1")} className="td2-input px-3 py-2 text-sm" />
                      <input value={gearMod1Value} onChange={(e) => setGearMod1Value(e.target.value)} placeholder={tx("Valor 1 (ex: 12%)", "Value 1 (e.g. 12%)")} className="td2-input px-3 py-2 text-sm" />
                    </div>
                  ) : null}
                  {gearModCount >= 2 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:col-span-2">
                      <input value={gearMod2} onChange={(e) => setGearMod2(e.target.value)} placeholder={tx("Mod 2", "Mod 2")} className="td2-input px-3 py-2 text-sm" />
                      <input value={gearMod2Value} onChange={(e) => setGearMod2Value(e.target.value)} placeholder={tx("Valor 2", "Value 2")} className="td2-input px-3 py-2 text-sm" />
                    </div>
                  ) : null}
                </div>
              </GearAcc>

              {gearFormMode === "advanced" ? (
                <GearAcc
                  step="advanced"
                  title={tx("Avançado", "Advanced")}
                  summary={tx("Links, notas e classificações", "Links, notes and classifications")}
                  innerRef={stepRefs.advanced}
                  openStep={openStep}
                  setOpenStep={setOpenStep}
                  stepOk={stepOk}
                  stepOrder={stepOrder}
                  nextMissingStep={nextMissingStep}
                  gotoStep={gotoStep}
                  tx={tx}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={modSlots}
                      onChange={(e) => setModSlots(e.target.value)}
                      placeholder="modSlots (0,1,2...)"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={wikiUrl}
                      onChange={(e) => setWikiUrl(e.target.value)}
                      placeholder="wikiUrl"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="imageUrl"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={targetLootRef}
                      onChange={(e) => setTargetLootRef(e.target.value)}
                      placeholder="targetLootRef (ex: BRAND_Providence)"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={tx("notes (opcional)", "notes (optional)")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <select
                      value={attributeCategory}
                      onChange={(e) => setAttributeCategory(e.target.value)}
                      className="td2-select px-3 py-2 text-sm"
                    >
                      {ATTRIBUTE_CATEGORY_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Categoria de Atributo (opcional)", "AttributeCategory (optional)")}</option>
                      ))}
                    </select>
                    <select
                      value={talentType}
                      onChange={(e) => setTalentType(e.target.value)}
                      className="td2-select px-3 py-2 text-sm"
                    >
                      {TALENT_TYPE_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Tipo de Talento (opcional)", "TalentType (optional)")}</option>
                      ))}
                    </select>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={tx("Descrição", "Description")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                  </div>

                  <input
                    value={acquisition}
                    onChange={(e) => setAcquisition(e.target.value)}
                    placeholder={tx("Aquisição (como obter)", "Acquisition (how to obtain)")}
                    className="td2-input w-full px-3 py-2 text-sm mt-3"
                  />
                </GearAcc>
              ) : null}
            </div>

            <div className="text-xs td2-muted">
              {tx(
                "Dica: no modo guiado, o atributo central define a cor automaticamente. Gear Set (verde) usa setId; High-End/Named usa brandId.",
                "Tip: in guided mode, the core attribute sets the color automatically. Gear Set uses setId; High-End/Named uses brandId.",
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip ok={weaponCompletion.basic} label={tx("Básico", "Basic")} />
              <Chip ok={weaponCompletion.stats} label={tx("Status", "Stats")} />
              <Chip ok={weaponCompletion.attrs} label={tx("Atributos", "Attributes")} />
              <Chip ok={weaponCompletion.mods} label={tx("Mods", "Mods")} />
            </div>

            <div className="td2-stepnav">
              {weaponStepOrder.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`td2-stepbtn ${openWeaponStep === s ? "td2-stepbtn--active" : ""}`}
                  onClick={() => gotoWeaponStep(s)}
                >
                  {s === "basic" ? tx("Básico", "Basic") :
                   s === "stats" ? tx("Status", "Stats") :
                   s === "attrs" ? tx("Atributos", "Attributes") :
                   s === "mods" ? tx("Mods", "Mods") :
                   tx("Avançado", "Advanced")}
                </button>
              ))}
              {nextMissingWeaponStep ? (
                <button type="button" className="td2-stepbtn" onClick={() => gotoWeaponStep(nextMissingWeaponStep)}>
                  {tx("Ir para o que falta", "Go to missing")}
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <WeaponAcc
                step="basic"
                title={tx("Básico", "Basic")}
                summary={`${name?.trim() ? name.trim() : tx("Nome", "Name")} · ${weaponClass || tx("Classe", "Class")} · ${rarity || tx("Raridade", "Rarity")}`}
                innerRef={weaponStepRefs.basic}
                openWeaponStep={openWeaponStep}
                setOpenWeaponStep={setOpenWeaponStep}
                weaponStepOk={weaponStepOk}
                weaponStepOrder={weaponStepOrder}
                nextMissingWeaponStep={nextMissingWeaponStep}
                gotoWeaponStep={gotoWeaponStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={weaponFormMode}
                    onChange={(e) => setWeaponFormMode(e.target.value as GearFormMode)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    <option value="quick">{tx("Adição Rápida (MVP)", "Quick Add (MVP)")}</option>
                    <option value="advanced">{tx("Avançado", "Advanced")}</option>
                  </select>
                  <div className="md:col-span-3 text-xs td2-muted self-center">
                    {tx(
                      "MVP: nome, raridade, classe, status, atributos e mods. Avançado libera links/notas/descrição e JSON extra.",
                      "MVP: name, rarity, class, stats, attributes and mods. Advanced enables links/notes/description and extra JSON.",
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={mode === "create" ? tx("Nome (obrigatório)", "Name (required)") : tx("Nome (opcional)", "Name (optional)")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <select
                    value={rarity}
                    onChange={(e) => setRarity(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {RARITY_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    value={weaponClass}
                    onChange={(e) => setWeaponClass(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {WEAPON_CLASS_OPTIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-3">
                  <ComboBox
                    value={talentText}
                    onChange={(next) => {
                      setTalentText(next);
                      const q = next.trim().toLowerCase();
                      const found = (talentsQuery.data ?? []).find((t) => t.name.toLowerCase() === q || t.id.toLowerCase() === q);
                      setTalentId(found?.id ?? "");
                    }}
                    onPick={(opt) => {
                      setTalentText(opt.label);
                      setTalentId(opt.id);
                    }}
                    options={talentOptions}
                    placeholder={tx("Talento da arma (opcional)", "Weapon talent (optional)")}
                    className="td2-input px-3 py-2 text-sm w-full"
                    disabled={talentsQuery.isLoading}
                    allowCreate
                    createLabel={(q) => tx(`Criar talento: "${q}"`, `Create talent: "${q}"`)}
                    onCreate={openCreateTalent}
                  />
                </div>
              </WeaponAcc>

              <WeaponAcc
                step="stats"
                title={tx("Status", "Stats")}
                summary={[
                  weaponTotalDamage.trim() ? `${tx("Dano", "Damage")}: ${weaponTotalDamage.trim()}` : "",
                  weaponRpm.trim() ? `RPM: ${weaponRpm.trim()}` : "",
                  weaponMagSize.trim() ? `${tx("Pente", "Mag")}: ${weaponMagSize.trim()}` : "",
                ].filter(Boolean).join(" · ") || tx("Opcional", "Optional")}
                innerRef={weaponStepRefs.stats}
                openWeaponStep={openWeaponStep}
                setOpenWeaponStep={setOpenWeaponStep}
                weaponStepOk={weaponStepOk}
                weaponStepOrder={weaponStepOrder}
                nextMissingWeaponStep={nextMissingWeaponStep}
                gotoWeaponStep={gotoWeaponStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={weaponTotalDamage}
                    onChange={(e) => setWeaponTotalDamage(e.target.value)}
                    placeholder={tx("Dano total", "Total damage")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponBaseDamage}
                    onChange={(e) => setWeaponBaseDamage(e.target.value)}
                    placeholder={tx("Dano base (texto)", "Base damage (text)")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponRpm}
                    onChange={(e) => setWeaponRpm(e.target.value)}
                    placeholder="RPM"
                    className="td2-input px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                  <input
                    value={weaponMagSize}
                    onChange={(e) => setWeaponMagSize(e.target.value)}
                    placeholder={tx("Tamanho do pente", "Mag size")}
                    className="td2-input px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                  <input
                    value={weaponDpm}
                    onChange={(e) => setWeaponDpm(e.target.value)}
                    placeholder="DPM"
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponPnt}
                    onChange={(e) => setWeaponPnt(e.target.value)}
                    placeholder="PNT"
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponOptimalRange}
                    onChange={(e) => setWeaponOptimalRange(e.target.value)}
                    placeholder={tx("Alcance ideal", "Optimal range")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponHeadshotPct}
                    onChange={(e) => setWeaponHeadshotPct(e.target.value)}
                    placeholder={tx("% dano tiro na cabeça", "Headshot damage %")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                </div>
              </WeaponAcc>

              <WeaponAcc
                step="attrs"
                title={tx("Atributos", "Attributes")}
                summary={
                  [
                    weaponCoreAttribute.trim() ? `${tx("Central", "Core")}: ${weaponCoreAttribute.trim()}` : "",
                    weaponAttribute.trim() ? `${tx("Atributo", "Attribute")}: ${weaponAttribute.trim()}` : "",
                    weaponExpertise.trim() ? `${tx("Perícia", "Expertise")}: ${weaponExpertise.trim()}` : "",
                  ].filter(Boolean).join(" · ") || tx("Opcional", "Optional")
                }
                innerRef={weaponStepRefs.attrs}
                openWeaponStep={openWeaponStep}
                setOpenWeaponStep={setOpenWeaponStep}
                weaponStepOk={weaponStepOk}
                weaponStepOrder={weaponStepOrder}
                nextMissingWeaponStep={nextMissingWeaponStep}
                gotoWeaponStep={gotoWeaponStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={weaponCoreAttribute}
                    onChange={(e) => setWeaponCoreAttribute(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    {WEAPON_CORE_ATTRIBUTE_OPTIONS.map((x) => (
                      <option key={x || "none"} value={x}>{x || tx("Atributo central (opcional)", "Core attribute (optional)")}</option>
                    ))}
                  </select>
                  <input
                    value={weaponAttribute}
                    onChange={(e) => setWeaponAttribute(e.target.value)}
                    placeholder={tx("Atributo", "Attribute")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponExpertise}
                    onChange={(e) => setWeaponExpertise(e.target.value)}
                    placeholder={tx("Perícia", "Expertise")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                </div>
              </WeaponAcc>

              <WeaponAcc
                step="mods"
                title={tx("Mods", "Mods")}
                summary={weaponCompletion.mods ? tx("Preenchido", "Filled") : tx("Opcional", "Optional")}
                innerRef={weaponStepRefs.mods}
                openWeaponStep={openWeaponStep}
                setOpenWeaponStep={setOpenWeaponStep}
                weaponStepOk={weaponStepOk}
                weaponStepOrder={weaponStepOrder}
                nextMissingWeaponStep={nextMissingWeaponStep}
                gotoWeaponStep={gotoWeaponStep}
                tx={tx}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={weaponModMag}
                    onChange={(e) => setWeaponModMag(e.target.value)}
                    placeholder={tx("Modificação Pente", "Magazine Mod")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponModScope}
                    onChange={(e) => setWeaponModScope(e.target.value)}
                    placeholder={tx("Modificação Mira", "Scope Mod")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponModMuzzle}
                    onChange={(e) => setWeaponModMuzzle(e.target.value)}
                    placeholder={tx("Modificação Bocal", "Muzzle Mod")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                  <input
                    value={weaponModUnderbarrel}
                    onChange={(e) => setWeaponModUnderbarrel(e.target.value)}
                    placeholder={tx("Modificação Suporte inferior", "Underbarrel Mod")}
                    className="td2-input px-3 py-2 text-sm"
                  />
                </div>
              </WeaponAcc>

              {weaponFormMode === "advanced" ? (
                <WeaponAcc
                  step="advanced"
                  title={tx("Avançado", "Advanced")}
                  summary={tx("Links, notas e classificações", "Links, notes and classifications")}
                  innerRef={weaponStepRefs.advanced}
                  openWeaponStep={openWeaponStep}
                  setOpenWeaponStep={setOpenWeaponStep}
                  weaponStepOk={weaponStepOk}
                  weaponStepOrder={weaponStepOrder}
                  nextMissingWeaponStep={nextMissingWeaponStep}
                  gotoWeaponStep={gotoWeaponStep}
                  tx={tx}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={wikiUrl}
                      onChange={(e) => setWikiUrl(e.target.value)}
                      placeholder="wikiUrl"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="imageUrl"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={targetLootRef}
                      onChange={(e) => setTargetLootRef(e.target.value)}
                      placeholder="targetLootRef"
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={tx("notes (opcional)", "notes (optional)")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <select
                      value={attributeCategory}
                      onChange={(e) => setAttributeCategory(e.target.value)}
                      className="td2-select px-3 py-2 text-sm"
                    >
                      {ATTRIBUTE_CATEGORY_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Categoria de Atributo (opcional)", "AttributeCategory (optional)")}</option>
                      ))}
                    </select>
                    <select
                      value={talentType}
                      onChange={(e) => setTalentType(e.target.value)}
                      className="td2-select px-3 py-2 text-sm"
                    >
                      {TALENT_TYPE_OPTIONS.map((x) => (
                        <option key={x || "none"} value={x}>{x || tx("Tipo de Talento (opcional)", "TalentType (optional)")}</option>
                      ))}
                    </select>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={tx("Descrição", "Description")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                  </div>

                  <input
                    value={acquisition}
                    onChange={(e) => setAcquisition(e.target.value)}
                    placeholder={tx("Aquisição (como obter)", "Acquisition (how to obtain)")}
                    className="td2-input w-full px-3 py-2 text-sm mt-3"
                  />
                </WeaponAcc>
              ) : null}
            </div>
          </>
        )}

        {(type === "weapon" ? weaponFormMode === "advanced" : gearFormMode === "advanced") ? (
          <textarea
            value={detailEntries}
            onChange={(e) => setDetailEntries(e.target.value)}
            rows={8}
            placeholder={tx('Array JSON de detalhes, ex: [{"group":"base","key":"Weapon Damage","value":"15","unit":"%","order":1}]', 'Detail entries JSON array, e.g. [{"group":"base","key":"Weapon Damage","value":"15","unit":"%","order":1}]')}
            className="td2-textarea w-full px-3 py-2 text-sm font-mono"
          />
        ) : (
          <div className="text-xs td2-muted">
            {type === "gear"
              ? (
                <>
                  {tx("Atributos roláveis (CHC/CHD etc.) devem ser cadastrados depois em", "Rollable attributes (CHC/CHD etc.) must be created later in")}{" "}
                  <code className="td2-code px-1.5 py-0.5">ItemAttrRule</code>.
                </>
              )
              : tx("Detalhes extras em JSON ficam disponíveis no modo Avançado.", "Extra JSON detail entries are available in Advanced mode.")}
          </div>
        )}

        {err ? <div className="text-sm text-red-300">{err}</div> : null}
        {result ? (
          <pre className="td2-code text-xs overflow-auto whitespace-pre-wrap rounded-2xl p-4">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
        </div>
      </section>

      {createTalentOpen ? (
        <div className="td2-overlay fixed inset-0 z-[70]">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="td2-modal w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl">
              <div className="td2-card-header sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] td2-muted uppercase tracking-[0.12em] truncate">
                    {tx("Criar talento", "Create talent")}
                  </div>
                  <div className="td2-heading text-sm font-semibold truncate">{createTalentName}</div>
                </div>
                <button
                  type="button"
                  className="td2-btn text-xs px-3 py-1.5"
                  onClick={() => setCreateTalentOpen(false)}
                  disabled={createTalentLoading}
                >
                  {tx("Fechar", "Close")}
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={createTalentName}
                    onChange={(e) => setCreateTalentName(e.target.value)}
                    className="td2-input px-3 py-2 text-sm"
                    placeholder={tx("Nome", "Name")}
                  />
                  <select
                    value={createTalentType}
                    onChange={(e) => setCreateTalentType(e.target.value)}
                    className="td2-select px-3 py-2 text-sm"
                  >
                    <option value="Weapon">Weapon</option>
                    <option value="Chest">Chest</option>
                    <option value="Backpack">Backpack</option>
                    <option value="GearSet">GearSet</option>
                  </select>
                </div>

                <textarea
                  value={createTalentDesc}
                  onChange={(e) => setCreateTalentDesc(e.target.value)}
                  rows={7}
                  className="td2-textarea w-full px-3 py-2 text-sm"
                  placeholder={tx("Descrição do talento (no estilo do jogo)", "Talent description (game-like)")}
                />

                <input
                  value={createTalentWikiUrl}
                  onChange={(e) => setCreateTalentWikiUrl(e.target.value)}
                  className="td2-input px-3 py-2 text-sm w-full"
                  placeholder="wikiUrl (optional)"
                />

                {createTalentErr ? <div className="text-xs text-red-300">{createTalentErr}</div> : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="td2-btn px-3 py-2 text-sm"
                    onClick={() => setCreateTalentOpen(false)}
                    disabled={createTalentLoading}
                  >
                    {tx("Cancelar", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className="td2-btn td2-btn--accent px-4 py-2 text-sm"
                    onClick={submitCreateTalent}
                    disabled={createTalentLoading}
                  >
                    {createTalentLoading ? tx("Criando...", "Creating...") : tx("Criar talento", "Create talent")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ItemPreviewCard
        tx={tx}
        type={type}
        slot={slot}
        rarity={rarity}
        weaponClass={weaponClass}
        name={name}
        id={id}
        description={description}
        selectedBrandName={selectedBrand?.name ?? null}
        selectedSetName={selectedSetNamePreview}
        brandBonuses={brandBonusesPreview}
        setBonuses={setBonusesPreview}
        gearCorePreview={gearCorePreview}
        gearCoreName={gearCoreAttrName}
        gearCoreValue={gearCoreAttrValue}
        gearArmorValue={gearArmorValue}
        gearProficiencyRank={gearProficiencyRank}
        gearProficiencyProgress={gearProficiencyProgress}
        gearProficiencyMax={gearProficiencyMax}
        gearMinorAttrs={[
          ...(gearMinorAttrCount >= 1 && gearMinorAttr1Name ? [{ name: gearMinorAttr1Name, value: gearMinorAttr1Value }] : []),
          ...(gearMinorAttrCount >= 2 && gearMinorAttr2Name ? [{ name: gearMinorAttr2Name, value: gearMinorAttr2Value }] : []),
        ]}
        gearMods={[
          ...(gearModCount >= 1 ? [`${gearMod1}${gearMod1Value ? `: ${gearMod1Value}` : ""}`] : []),
          ...(gearModCount >= 2 ? [`${gearMod2}${gearMod2Value ? `: ${gearMod2Value}` : ""}`] : []),
        ].filter((x) => String(x ?? "").trim())}
        talentId={talentId}
        talentName={selectedTalent?.name ?? null}
        modSlots={modSlots}
        acquisition={acquisition}
        weaponTotalDamage={weaponTotalDamage}
        weaponBaseDamage={weaponBaseDamage}
        weaponRpm={weaponRpm}
        weaponMagSize={weaponMagSize}
        weaponDpm={weaponDpm}
        weaponPnt={weaponPnt}
        weaponOptimalRange={weaponOptimalRange}
        weaponHeadshotPct={weaponHeadshotPct}
        weaponCoreAttribute={weaponCoreAttribute}
        weaponAttribute={weaponAttribute}
        weaponExpertise={weaponExpertise}
        weaponModsPreview={weaponModsPreview}
      />
      </div>

      <div className="td2-card rounded-2xl p-4 space-y-3">
        <div className="td2-heading text-sm font-medium">{tx("Excluir Item", "Delete Item")}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={deleteId}
            onChange={(e) => setDeleteId(e.target.value)}
            placeholder={tx("ID do item para excluir", "Item ID to delete")}
            className="td2-input px-3 py-2 text-sm"
          />
          <button
            onClick={remove}
            disabled={loading}
            className="td2-btn td2-btn-danger px-4 py-2 disabled:opacity-50 text-sm"
          >
            {loading ? tx("Excluindo...", "Deleting...") : tx("Excluir", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
