type ItemType = "gear" | "weapon";

type GearMinorAttr = { name: string; value: string };

type PreviewProps = {
  tx: (pt: string, en: string) => string;
  sticky?: boolean;
  type: ItemType;
  slot: string;
  rarity: string;
  weaponClass: string;
  name: string;
  id: string;
  description: string;
  selectedBrandName: string | null;
  selectedSetName: string | null;
  selectedSetDescription?: string | null;
  brandBonuses: string[];
  setBonuses: string[];
  gearCorePreview: string;
  gearCoreName?: string;
  gearCoreValue?: string;
  gearArmorValue?: string;
  gearProficiencyRank?: string;
  gearProficiencyProgress?: string;
  gearProficiencyMax?: string;
  gearMinorAttrs?: GearMinorAttr[];
  gearMods?: string[];
  talentId: string;
  talentName?: string | null;
  modSlots: string;
  acquisition: string;
  weaponTotalDamage: string;
  weaponBaseDamage: string;
  weaponRpm: string;
  weaponMagSize: string;
  weaponDpm: string;
  weaponPnt: string;
  weaponOptimalRange: string;
  weaponHeadshotPct: string;
  weaponCoreAttribute: string;
  weaponAttribute: string;
  weaponExpertise: string;
  weaponModsPreview: string[];
};

function coreColorByName(name?: string): "red" | "blue" | "yellow" | "none" {
  const n = String(name ?? "").toLowerCase();
  if (!n) return "none";
  if (n.includes("weapon")) return "red";
  if (n.includes("armor")) return "blue";
  if (n.includes("skill")) return "yellow";
  return "none";
}

function minorColorByName(name?: string): "red" | "blue" | "yellow" | "none" {
  const n = String(name ?? "").toLowerCase();
  if (!n) return "none";
  if (n.includes("critical") || n.includes("headshot") || n.includes("weapon") || n.includes("handling")) return "red";
  if (n.includes("armor") || n.includes("health") || n.includes("hazard") || n.includes("regen") || n.includes("resistance") || n.includes("incoming")) return "blue";
  if (n.includes("skill") || n.includes("status") || n.includes("repair") || n.includes("ammo")) return "yellow";
  return "none";
}

function ColorDot({ c }: { c: "red" | "blue" | "yellow" | "none" }) {
  return <span className={`td2-dot td2-dot--${c}`} />;
}

function StatRow({ c, left, right }: { c: "red" | "blue" | "yellow" | "none"; left: string; right: string }) {
  return (
    <div className="td2-stat-row">
      <div className="td2-stat-left">
        <ColorDot c={c} />
        <span className="td2-stat-value">{left || "-"}</span>
      </div>
      <div className="td2-stat-name">{right || "-"}</div>
      <div className={`td2-bar td2-bar--${c}`} />
    </div>
  );
}

export default function ItemPreviewCard(props: PreviewProps) {
  const {
    tx,
    sticky = true,
    type,
    slot,
    rarity,
    weaponClass,
    name,
    id,
    description,
    selectedBrandName,
    selectedSetName,
    selectedSetDescription,
    brandBonuses,
    setBonuses,
    gearCorePreview,
    gearCoreName,
    gearCoreValue,
    gearArmorValue,
    gearProficiencyRank,
    gearProficiencyProgress,
    gearProficiencyMax,
    gearMinorAttrs,
    gearMods,
    talentId,
    talentName,
    modSlots,
    acquisition,
    weaponTotalDamage,
    weaponBaseDamage,
    weaponRpm,
    weaponMagSize,
    weaponDpm,
    weaponPnt,
    weaponOptimalRange,
    weaponHeadshotPct,
    weaponCoreAttribute,
    weaponAttribute,
    weaponExpertise,
    weaponModsPreview,
  } = props;

  return (
    <aside className={`td2-preview-card rounded-2xl p-4 overflow-auto ${sticky ? "xl:sticky xl:top-6 xl:max-h-[calc(100vh-3.5rem)]" : ""}`}>
      <div className="td2-gamecard">
        <div className="td2-gamecard__hdr">
          <div>
            <div className="td2-gamecard__kicker">{type === "gear" ? slot : weaponClass} · {rarity}</div>
            <div className="td2-gamecard__title">{name || tx("Nome do item", "Item name")}</div>
          </div>
          <div className="td2-gamecard__meta">
            <div className="td2-gamecard__id">{id ? `ID ${id}` : tx("Novo", "New")}</div>
            {type === "gear" && gearArmorValue ? <div className="td2-gamecard__armor">{gearArmorValue} {tx("Proteção", "Armor")}</div> : null}
          </div>
        </div>

        {description ? <p className="td2-preview-quote mt-3">"{description}"</p> : null}

        {type === "gear" ? (
          <div className="space-y-4 mt-3">
            {selectedBrandName || brandBonuses.length ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Conjunto de marca", "Brand set")}</div>
                <div className="text-sm mt-1">{selectedBrandName || "-"}</div>
                {brandBonuses.length ? (
                  <ul className="mt-2 text-xs td2-muted space-y-1">
                    {brandBonuses.map((b, i) => <li key={i}>+ {b}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {selectedSetName || setBonuses.length ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Conjunto de equipamento", "Gear set")}</div>
                <div className="text-sm mt-1">{selectedSetName || "-"}</div>
                {selectedSetDescription ? <div className="text-xs td2-muted mt-1">{selectedSetDescription}</div> : null}
                {setBonuses.length ? (
                  <ul className="mt-2 text-xs td2-muted space-y-1">
                    {setBonuses.map((b, i) => <li key={i}>+ {b}</li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="td2-preview-section">
              <div className="td2-label">{tx("Atributo central", "Core attribute")}</div>
              <div className="mt-2">
                <StatRow
                  c={coreColorByName(gearCoreName)}
                  left={gearCoreValue || ""}
                  right={gearCoreName || gearCorePreview}
                />
              </div>
            </div>

            {gearProficiencyRank ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Ranque de Proficiência", "Proficiency Rank")}</div>
                <div className="flex items-center justify-between text-xs td2-muted mt-2">
                  <div>{tx("Rank", "Rank")}: <span className="text-slate-100">{gearProficiencyRank}</span></div>
                  {gearProficiencyProgress && gearProficiencyMax ? (
                    <div className="font-mono">{gearProficiencyProgress}/{gearProficiencyMax}</div>
                  ) : null}
                </div>
                <div className="td2-bar td2-bar--yellow mt-2" />
              </div>
            ) : null}

            {gearMinorAttrs?.length ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Atributos", "Attributes")}</div>
                <div className="mt-2 space-y-2">
                  {gearMinorAttrs.map((a, i) => (
                    <StatRow key={i} c={minorColorByName(a.name)} left={a.value || ""} right={a.name} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="td2-preview-section">
              <div className="td2-label">{tx("Talentos", "Talents")}</div>
              <div className="text-sm mt-2">{talentName || talentId || "-"}</div>
              <div className="text-xs td2-muted mt-1">{tx("Mod slots", "Mod slots")}: {modSlots || "-"}</div>
            </div>

            {gearMods?.length ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Espaço de Modificação", "Mod slots")}</div>
                <div className="mt-2 text-xs td2-muted space-y-1">
                  {gearMods.map((m, i) => (
                    <div key={i}>• {m}</div>
                  ))}
                </div>
              </div>
            ) : null}

            {acquisition ? (
              <div className="td2-preview-section">
                <div className="td2-label">{tx("Fonte", "Source")}</div>
                <div className="text-xs td2-muted mt-1">{acquisition}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4 mt-3">
            <div className="td2-preview-section">
              <div className="td2-label">{tx("Status", "Stats")}</div>
              <div className="text-xs td2-muted mt-2 space-y-1">
                <div>{tx("Dano total", "Total damage")}: {weaponTotalDamage || "-"}</div>
                <div>{tx("Dano base", "Base damage")}: {weaponBaseDamage || "-"}</div>
                <div>RPM: {weaponRpm || "-"}</div>
                <div>{tx("Tamanho do pente", "Mag size")}: {weaponMagSize || "-"}</div>
                <div>DPM: {weaponDpm || "-"}</div>
                <div>PNT: {weaponPnt || "-"}</div>
                <div>{tx("Alcance ideal", "Optimal range")}: {weaponOptimalRange || "-"}</div>
                <div>Headshot %: {weaponHeadshotPct || "-"}</div>
              </div>
            </div>

            <div className="td2-preview-section">
              <div className="td2-label">{tx("Atributos", "Attributes")}</div>
              <div className="text-xs td2-muted mt-2">
                <div>{tx("Central", "Core")}: {weaponCoreAttribute || "-"}</div>
                <div>{tx("Atributo", "Attribute")}: {weaponAttribute || "-"}</div>
                <div>{tx("Perícia", "Expertise")}: {weaponExpertise || "-"}</div>
              </div>
            </div>

            <div className="td2-preview-section">
              <div className="td2-label">{tx("Modificações", "Modifications")}</div>
              {weaponModsPreview.length ? (
                <ul className="mt-2 text-xs td2-muted space-y-1">
                  {weaponModsPreview.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              ) : (
                <div className="text-xs td2-muted mt-1">-</div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
