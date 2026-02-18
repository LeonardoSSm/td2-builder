import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api/http";
import { useI18n } from "../../i18n";

type Focus = "DPS" | "Tank" | "Skill";
type Core = "Red" | "Blue" | "Yellow";
const SLOTS = ["Mask", "Chest", "Backpack", "Gloves", "Holster", "Kneepads"] as const;

type RecommendedProfile = {
  id: string;
  name: string;
  description: string;
  focus: Focus;
  preferredCore: Core;
  setHints: string[];
  brandHints: string[];
  primaryWeaponHints: string[];
  secondaryWeaponHints: string[];
  slotOverrides?: Partial<Record<(typeof SLOTS)[number], string>>;
  enabled?: boolean;
};

type RecommendedProfileForm = Omit<RecommendedProfile, "id">;

const EMPTY_FORM: RecommendedProfileForm = {
  name: "",
  description: "",
  focus: "DPS",
  preferredCore: "Red",
  setHints: [],
  brandHints: [],
  primaryWeaponHints: [],
  secondaryWeaponHints: [],
  slotOverrides: {},
  enabled: true,
};

function csvToList(v: string): string[] {
  return v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function listToCsv(v?: string[]): string {
  return (v ?? []).join(", ");
}

export default function AdminRecommendedBuildsPage() {
  const { tx } = useI18n();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecommendedProfileForm>(EMPTY_FORM);
  const [setHintsInput, setSetHintsInput] = useState("");
  const [brandHintsInput, setBrandHintsInput] = useState("");
  const [primaryHintsInput, setPrimaryHintsInput] = useState("");
  const [secondaryHintsInput, setSecondaryHintsInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["recommended-profiles-admin"],
    queryFn: () => apiGet<RecommendedProfile[]>("/builds/recommended/admin"),
  });

  const selected = useMemo(
    () => profilesQuery.data?.find((x) => x.id === selectedId) ?? null,
    [profilesQuery.data, selectedId],
  );

  const upsert = useMutation({
    mutationFn: (payload: RecommendedProfileForm) => {
      if (selectedId?.trim()) {
        return apiPut<RecommendedProfile>(`/builds/recommended/admin/${selectedId.trim()}`, payload);
      }
      return apiPost<RecommendedProfile>("/builds/recommended/admin", payload);
    },
    onSuccess: async (saved) => {
      setMessage(tx("Perfil salvo com sucesso.", "Profile saved successfully."));
      if (saved?.id && typeof saved.id === "string") {
        setSelectedId(saved.id);
      }
      await qc.invalidateQueries({ queryKey: ["recommended-profiles-admin"] });
      await qc.invalidateQueries({ queryKey: ["recommended-builds"] });
      await qc.invalidateQueries({ queryKey: ["recommended-builds-home"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/builds/recommended/admin/${id}`),
    onSuccess: async () => {
      setMessage(tx("Perfil removido.", "Profile removed."));
      setSelectedId(null);
      resetForm();
      await qc.invalidateQueries({ queryKey: ["recommended-profiles-admin"] });
      await qc.invalidateQueries({ queryKey: ["recommended-builds"] });
      await qc.invalidateQueries({ queryKey: ["recommended-builds-home"] });
    },
  });

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setSetHintsInput("");
    setBrandHintsInput("");
    setPrimaryHintsInput("");
    setSecondaryHintsInput("");
  };

  const fillForm = (p: RecommendedProfile) => {
    setForm({
      name: p.name,
      description: p.description,
      focus: p.focus,
      preferredCore: p.preferredCore,
      setHints: p.setHints,
      brandHints: p.brandHints,
      primaryWeaponHints: p.primaryWeaponHints,
      secondaryWeaponHints: p.secondaryWeaponHints,
      slotOverrides: p.slotOverrides ?? {},
      enabled: p.enabled ?? true,
    });
    setSetHintsInput(listToCsv(p.setHints));
    setBrandHintsInput(listToCsv(p.brandHints));
    setPrimaryHintsInput(listToCsv(p.primaryWeaponHints));
    setSecondaryHintsInput(listToCsv(p.secondaryWeaponHints));
  };

  const onSave = () => {
    if (!form.name.trim()) return setMessage(tx("Nome é obrigatório.", "Name is required."));
    setMessage(null);
    upsert.mutate({
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      setHints: csvToList(setHintsInput),
      brandHints: csvToList(brandHintsInput),
      primaryWeaponHints: csvToList(primaryHintsInput),
      secondaryWeaponHints: csvToList(secondaryHintsInput),
    });
  };

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Builds Recomendadas", "Recommended Builds Admin")}</div>
        <div className="text-xs td2-subheading">{tx("Gerencie perfis de recomendação e overrides por slot.", "Manage recommendation profiles and per-slot overrides.")}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className="td2-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{tx("Perfis", "Profiles")}</div>
            <button
              className="td2-btn text-xs px-2 py-1"
              onClick={() => {
                setSelectedId(null);
                resetForm();
              }}
            >
              {tx("Novo", "New")}
            </button>
          </div>

          {profilesQuery.isLoading ? <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
          {profilesQuery.isError ? (
            <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(profilesQuery.error as any)?.message}</div>
          ) : null}
          <div className="space-y-1 max-h-[540px] overflow-auto pr-1">
            {(profilesQuery.data ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  fillForm(p);
                }}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs ${selectedId === p.id ? "border-orange-500/70 bg-orange-950/20" : "border-slate-800 bg-slate-900/30"}`}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="td2-muted mt-1">{p.focus} · {p.preferredCore}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="td2-card rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={tx("Nome", "Name")}
              className="td2-input px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder={tx("Descrição", "Description")}
            className="td2-input px-3 py-2 text-sm min-h-20"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={form.focus}
              onChange={(e) => setForm((p) => ({ ...p, focus: e.target.value as Focus }))}
              className="td2-select px-3 py-2 text-sm"
            >
              <option value="DPS">DPS</option>
              <option value="Tank">Tank</option>
              <option value="Skill">Skill</option>
            </select>
            <select
              value={form.preferredCore}
              onChange={(e) => setForm((p) => ({ ...p, preferredCore: e.target.value as Core }))}
              className="td2-select px-3 py-2 text-sm"
            >
              <option value="Red">Red</option>
              <option value="Blue">Blue</option>
              <option value="Yellow">Yellow</option>
            </select>
            <label className="flex items-center gap-2 text-sm td2-muted px-2">
              <input
                type="checkbox"
                checked={form.enabled !== false}
                onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              {tx("Ativo", "Enabled")}
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={setHintsInput} onChange={(e) => setSetHintsInput(e.target.value)} placeholder={tx("Set hints (csv)", "Set hints (csv)")} className="td2-input px-3 py-2 text-sm" />
            <input value={brandHintsInput} onChange={(e) => setBrandHintsInput(e.target.value)} placeholder={tx("Brand hints (csv)", "Brand hints (csv)")} className="td2-input px-3 py-2 text-sm" />
            <input value={primaryHintsInput} onChange={(e) => setPrimaryHintsInput(e.target.value)} placeholder={tx("Primary weapon hints (csv)", "Primary weapon hints (csv)")} className="td2-input px-3 py-2 text-sm" />
            <input value={secondaryHintsInput} onChange={(e) => setSecondaryHintsInput(e.target.value)} placeholder={tx("Secondary weapon hints (csv)", "Secondary weapon hints (csv)")} className="td2-input px-3 py-2 text-sm" />
          </div>

          <div>
            <div className="text-xs td2-muted mb-2">{tx("Override de item por slot (opcional)", "Per-slot item override (optional)")}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SLOTS.map((slot) => (
                <input
                  key={slot}
                  value={form.slotOverrides?.[slot] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      slotOverrides: { ...(p.slotOverrides ?? {}), [slot]: e.target.value },
                    }))
                  }
                  placeholder={`${slot} itemId`}
                  className="td2-input px-3 py-2 text-sm"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={onSave} disabled={upsert.isPending} className="td2-btn text-xs px-3 py-2">
              {upsert.isPending ? tx("Salvando...", "Saving...") : tx("Salvar perfil", "Save profile")}
            </button>
            {selected ? (
              <button
                onClick={() => remove.mutate(selected.id)}
                disabled={remove.isPending}
                className="td2-btn text-xs px-3 py-2"
              >
                {remove.isPending ? tx("Removendo...", "Removing...") : tx("Remover perfil", "Remove profile")}
              </button>
            ) : null}
          </div>
          {message ? <div className="text-xs td2-muted">{message}</div> : null}
          {upsert.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(upsert.error as any)?.message}</div> : null}
          {remove.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(remove.error as any)?.message}</div> : null}
        </div>
      </div>
    </div>
  );
}
