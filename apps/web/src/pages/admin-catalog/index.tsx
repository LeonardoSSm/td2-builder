import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api/http";
import { useI18n } from "../../i18n";

type Tab = "brands" | "gearSets" | "talents" | "attributes";

type Brand = { id: string; name: string; bonus1?: string | null; bonus2?: string | null; bonus3?: string | null; wikiUrl?: string | null; logoUrl?: string | null };
type GearSet = { id: string; name: string; bonus2?: string | null; bonus3?: string | null; bonus4?: string | null };
type Talent = { id: string; name: string; type: string; description?: string | null; wikiUrl?: string | null };
type Attribute = { id: string; name: string; category: string; unit: string; notes?: string | null };

function Tabs({ tab, setTab, tx }: { tab: Tab; setTab: (t: Tab) => void; tx: (pt: string, en: string) => string }) {
  const items: Array<{ id: Tab; label: string }> = [
    { id: "brands", label: tx("Marcas", "Brands") },
    { id: "gearSets", label: tx("Gear Sets", "Gear Sets") },
    { id: "talents", label: tx("Talentos", "Talents") },
    { id: "attributes", label: tx("Atributos", "Attributes") },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.id}
          className={`td2-btn text-xs px-3 py-2 ${tab === it.id ? "border-orange-500/60" : ""}`}
          onClick={() => setTab(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminCatalogPage() {
  const { tx } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("gearSets");

  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => apiGet<Brand[]>("/admin/brands") });
  const gearSets = useQuery({ queryKey: ["admin-gear-sets"], queryFn: () => apiGet<GearSet[]>("/admin/gear-sets") });
  const talents = useQuery({ queryKey: ["admin-talents"], queryFn: () => apiGet<Talent[]>("/admin/talents") });
  const attributes = useQuery({ queryKey: ["admin-attributes"], queryFn: () => apiGet<Attribute[]>("/admin/attributes") });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => {
    const id = selectedId;
    if (!id) return null;
    if (tab === "brands") return (brands.data ?? []).find((x) => x.id === id) ?? null;
    if (tab === "gearSets") return (gearSets.data ?? []).find((x) => x.id === id) ?? null;
    if (tab === "talents") return (talents.data ?? []).find((x) => x.id === id) ?? null;
    return (attributes.data ?? []).find((x) => x.id === id) ?? null;
  }, [selectedId, tab, brands.data, gearSets.data, talents.data, attributes.data]);

  const resetSelection = () => setSelectedId(null);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-brands"] });
    await qc.invalidateQueries({ queryKey: ["admin-gear-sets"] });
    await qc.invalidateQueries({ queryKey: ["admin-talents"] });
    await qc.invalidateQueries({ queryKey: ["admin-attributes"] });
    await qc.invalidateQueries({ queryKey: ["catalog-brands-for-admin"] });
    await qc.invalidateQueries({ queryKey: ["catalog-gear-sets-for-admin"] });
  };

  // Forms
  const [name, setName] = useState("");
  const [f1, setF1] = useState("");
  const [f2, setF2] = useState("");
  const [f3, setF3] = useState("");
  const [f4, setF4] = useState("");
  const [extraA, setExtraA] = useState("");
  const [extraB, setExtraB] = useState("");

  const fillFromSelected = () => {
    const s: any = selected;
    if (!s) return;
    setName(s.name ?? "");
    setF1(s.bonus1 ?? s.bonus2 ?? "");
    setF2(s.bonus2 ?? s.bonus3 ?? "");
    setF3(s.bonus3 ?? s.bonus4 ?? "");
    setF4(s.bonus4 ?? "");
    setExtraA(s.type ?? s.category ?? "");
    setExtraB(s.unit ?? "");
  };

  const save = useMutation({
    mutationFn: async () => {
      const id = selectedId;
      const n = name.trim();
      if (!n) throw new Error(tx("Nome é obrigatório.", "Name is required."));

      if (tab === "brands") {
        const payload: any = { name: n, bonus1: f1 || undefined, bonus2: f2 || undefined, bonus3: f3 || undefined };
        return id ? apiPut(`/admin/brands/${id}`, payload) : apiPost(`/admin/brands`, payload);
      }
      if (tab === "gearSets") {
        const payload: any = { name: n };
        // For now only name in UI; bonuses can be added later.
        return id ? apiPut(`/admin/gear-sets/${id}`, payload) : apiPost(`/admin/gear-sets`, payload);
      }
      if (tab === "talents") {
        const payload: any = { name: n, type: extraA || "Weapon", description: f1 || undefined };
        return id ? apiPut(`/admin/talents/${id}`, payload) : apiPost(`/admin/talents`, payload);
      }
      const payload: any = { name: n, category: extraA || "Offensive", unit: extraB || "PERCENT", notes: f1 || undefined };
      return id ? apiPut(`/admin/attributes/${id}`, payload) : apiPost(`/admin/attributes`, payload);
    },
    onSuccess: async () => {
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error(tx("Selecione um item.", "Select an item."));
      const id = selectedId;
      if (tab === "brands") return apiDelete(`/admin/brands/${id}`);
      if (tab === "gearSets") return apiDelete(`/admin/gear-sets/${id}`);
      if (tab === "talents") return apiDelete(`/admin/talents/${id}`);
      return apiDelete(`/admin/attributes/${id}`);
    },
    onSuccess: async () => {
      resetSelection();
      await invalidate();
    },
  });

  const list = tab === "brands" ? (brands.data ?? []) : tab === "gearSets" ? (gearSets.data ?? []) : tab === "talents" ? (talents.data ?? []) : (attributes.data ?? []);
  const loading = brands.isLoading || gearSets.isLoading || talents.isLoading || attributes.isLoading;
  const error = (brands.error as any)?.message || (gearSets.error as any)?.message || (talents.error as any)?.message || (attributes.error as any)?.message;

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Catálogo", "Admin Catalog")}</div>
        <div className="text-xs td2-subheading">{tx("Gerencie marcas, sets, talentos e atributos.", "Manage brands, sets, talents and attributes.")}</div>
      </div>

      <div className="td2-card rounded-2xl p-4 space-y-3">
        <Tabs tab={tab} setTab={(t) => { setTab(t); resetSelection(); }} tx={tx} />
        {loading ? <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
        {error ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {error}</div> : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className="td2-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{tx("Lista", "List")}</div>
            <button
              className="td2-btn text-[11px] px-2 py-1"
              onClick={() => {
                resetSelection();
                setName("");
                setF1("");
                setF2("");
                setF3("");
                setF4("");
                setExtraA("");
                setExtraB("");
              }}
            >
              {tx("Novo", "New")}
            </button>
          </div>

          <div className="space-y-1 max-h-[540px] overflow-auto pr-1">
            {(list as any[]).map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  setSelectedId(x.id);
                  queueMicrotask(fillFromSelected);
                }}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs ${selectedId === x.id ? "border-orange-500/70 bg-orange-950/20" : "border-slate-800 bg-slate-900/30"}`}
              >
                <div className="font-semibold">{x.name}</div>
                <div className="td2-muted mt-1 font-mono">{x.id}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="td2-card rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold">{tx("Editor", "Editor")}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx("Nome", "Name")} className="td2-input px-3 py-2 text-sm" />

            {tab === "talents" ? (
              <select value={extraA} onChange={(e) => setExtraA(e.target.value)} className="td2-select px-3 py-2 text-sm">
                <option value="Weapon">Weapon</option>
                <option value="Chest">Chest</option>
                <option value="Backpack">Backpack</option>
                <option value="GearSet">GearSet</option>
              </select>
            ) : tab === "attributes" ? (
              <select value={extraA} onChange={(e) => setExtraA(e.target.value)} className="td2-select px-3 py-2 text-sm">
                <option value="Offensive">Offensive</option>
                <option value="Defensive">Defensive</option>
                <option value="Utility">Utility</option>
              </select>
            ) : (
              <div className="text-xs td2-muted self-center">{selectedId ? tx("Editando", "Editing") : tx("Criando", "Creating")}</div>
            )}
          </div>

          {tab === "brands" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={f1} onChange={(e) => setF1(e.target.value)} placeholder={tx("Bônus 1", "Bonus 1")} className="td2-input px-3 py-2 text-sm" />
              <input value={f2} onChange={(e) => setF2(e.target.value)} placeholder={tx("Bônus 2", "Bonus 2")} className="td2-input px-3 py-2 text-sm" />
              <input value={f3} onChange={(e) => setF3(e.target.value)} placeholder={tx("Bônus 3", "Bonus 3")} className="td2-input px-3 py-2 text-sm" />
            </div>
          ) : null}

          {tab === "talents" ? (
            <textarea value={f1} onChange={(e) => setF1(e.target.value)} placeholder={tx("Descrição", "Description")} className="td2-input px-3 py-2 text-sm min-h-24" />
          ) : null}

          {tab === "attributes" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={extraB} onChange={(e) => setExtraB(e.target.value)} className="td2-select px-3 py-2 text-sm">
                <option value="PERCENT">%</option>
                <option value="FLAT">flat</option>
              </select>
              <input value={f1} onChange={(e) => setF1(e.target.value)} placeholder={tx("Notas", "Notes")} className="td2-input px-3 py-2 text-sm" />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button className="td2-btn text-xs px-3 py-2" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? tx("Salvando...", "Saving...") : tx("Salvar", "Save")}
            </button>
            {selectedId ? (
              <button className="td2-btn td2-btn-danger text-xs px-3 py-2" onClick={() => remove.mutate()} disabled={remove.isPending}>
                {remove.isPending ? tx("Removendo...", "Removing...") : tx("Remover", "Remove")}
              </button>
            ) : null}
          </div>

          {save.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(save.error as any)?.message}</div> : null}
          {remove.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(remove.error as any)?.message}</div> : null}
        </div>
      </div>
    </div>
  );
}
