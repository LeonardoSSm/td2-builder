import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut } from "../../api/http";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/auth";

type Build = {
  id: string;
  name: string;
  slots: Array<{ slot: string; itemId?: string | null }>;
};

type GearItemOption = { id: string; name: string; slot: string };
type Summary = {
  coreCounts: { red: number; blue: number; yellow: number };
  brands: Array<{ name: string; pieces: number; bonusesActive: string[] }>;
  gearSets: Array<{ name: string; pieces: number; bonusesActive: string[] }>;
  talents: Array<{ name: string; type: string; description?: string | null }>;
};

type RecommendedBuild = {
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

const SLOTS = ["Mask","Chest","Backpack","Gloves","Holster","Kneepads"];

function normalizeSlotKey(slot?: string | null): string | null {
  if (!slot) return null;
  const raw = slot.trim().toLowerCase();
  const compact = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
    mask: "Mask",
    mascara: "Mask",
    chest: "Chest",
    colete: "Chest",
    backpack: "Backpack",
    mochila: "Backpack",
    gloves: "Gloves",
    luvas: "Gloves",
    holster: "Holster",
    coldre: "Holster",
    kneepads: "Kneepads",
    joelheira: "Kneepads",
    joelheiras: "Kneepads",
  };
  return map[compact] ?? null;
}

export default function BuildPage() {
  const { tx } = useI18n();
  const { me } = useAuth();
  const [buildId, setBuildId] = useState<string | null>(null);
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();

  // Allow deep-linking to a build created elsewhere (ex: Assistant widget).
  // Example: /build?id=abc123
  const urlBuildId = sp.get("id");
  useEffect(() => {
    if (!buildId && urlBuildId) setBuildId(urlBuildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBuildId]);

  const createBuild = useMutation({
    mutationFn: () => apiPost<Build>("/builds", { name: tx("Minha Build", "My Build") }),
    onSuccess: (b) => {
      setBuildId(b.id);
      const next = new URLSearchParams(sp);
      next.set("id", b.id);
      setSp(next);
      qc.invalidateQueries({ queryKey: ["my-builds"] });
    },
  });
  const recommended = useQuery({
    queryKey: ["recommended-builds"],
    queryFn: () => apiGet<RecommendedBuild[]>("/builds/recommended"),
  });

  const build = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => apiGet<Build>(`/builds/${buildId}`),
    enabled: !!buildId && !!me,
  });

  const summary = useQuery({
    queryKey: ["build-summary", buildId],
    queryFn: () => apiGet<Summary>(`/builds/${buildId}/summary`),
    enabled: !!buildId && !!me,
  });

  const gearOptions = useQuery({
    queryKey: ["gear-options"],
    queryFn: () => apiGet<{ items: GearItemOption[]; total: number }>(`/catalog/gear-items?take=200`),
  });

  const optionsBySlot = useMemo(() => {
    const all = gearOptions.data?.items ?? [];
    const map: Record<string, GearItemOption[]> = {};
    for (const s of SLOTS) map[s] = [];
    for (const it of all) {
      const slotKey = normalizeSlotKey(it.slot);
      if (!slotKey) continue;
      map[slotKey].push(it);
    }
    return map;
  }, [gearOptions.data]);

  const updateBuild = useMutation({
    mutationFn: (payload: any) => apiPut<Build>(`/builds/${buildId}`, payload),
    onSuccess: () => {
      if (!buildId) return;
      qc.invalidateQueries({ queryKey: ["build", buildId] });
      qc.invalidateQueries({ queryKey: ["build-summary", buildId] });
      qc.invalidateQueries({ queryKey: ["my-builds"] });
    },
  });
  const applyRecommended = useMutation({
    mutationFn: (rec: RecommendedBuild) =>
      apiPost<Build>(`/builds/recommended/${rec.id}/apply`, {
        name: tx("Build Recomendada", "Recommended Build") + ` - ${rec.name}`,
      }),
    onSuccess: (b) => {
      setBuildId(b.id);
      const next = new URLSearchParams(sp);
      next.set("id", b.id);
      setSp(next);
      qc.invalidateQueries({ queryKey: ["build", b.id] });
      qc.invalidateQueries({ queryKey: ["build-summary", b.id] });
      qc.invalidateQueries({ queryKey: ["my-builds"] });
    },
  });

  const myBuilds = useQuery({
    queryKey: ["my-builds"],
    queryFn: () => apiGet<Array<{ id: string; name: string; updatedAt: string }>>("/builds/mine"),
    enabled: !!me,
  });

  const slotValue = (slot: string) =>
    build.data?.slots?.find((s) => s.slot === slot)?.itemId ?? "";

  const onChangeSlot = (slot: string, itemId: string) => {
    updateBuild.mutate({ slots: [{ slot, itemId: itemId || null }] });
  };

  return (
    <div className="td2-page space-y-6">
      <div className="td2-card rounded-2xl overflow-hidden">
        <div className="td2-card-header px-4 py-3 font-medium text-sm td2-heading">
          {tx("Builds Recomendadas", "Recommended Builds")}
        </div>
        <div className="p-4">
          {recommended.isLoading ? (
            <div className="text-sm td2-muted">{tx("Carregando recomendações...", "Loading recommendations...")}</div>
          ) : recommended.isError ? (
            <div className="text-sm text-red-300">{tx("Erro", "Error")}: {(recommended.error as any)?.message}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(recommended.data ?? []).map((rec) => (
                <div key={rec.id} className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{rec.name}</div>
                      <div className="text-xs td2-muted">{rec.description}</div>
                    </div>
                    <span className="td2-chip px-2 py-1 text-[10px]">{rec.focus}</span>
                  </div>
                  <div className="text-xs td2-muted">
                    {tx("Slots preenchidos", "Filled slots")}: {rec.filledSlots}/{rec.totalSlots}
                  </div>
                  <div className="text-xs td2-muted">
                    {tx("Core principal", "Main core")}: {rec.preferredCore}
                  </div>
                  <div className="text-xs td2-muted">
                    {tx("Armas", "Weapons")}: {rec.primaryWeaponName ?? "-"} / {rec.secondaryWeaponName ?? "-"}
                  </div>
                  <button
                    onClick={() => applyRecommended.mutate(rec)}
                    disabled={!me || applyRecommended.isPending}
                    className="td2-btn text-xs px-3 py-1.5 w-full"
                  >
                    {applyRecommended.isPending ? tx("Aplicando...", "Applying...") : tx("Usar essa build", "Use this build")}
                  </button>
                </div>
              ))}
              {(recommended.data?.length ?? 0) === 0 ? (
                <div className="text-sm td2-muted col-span-full">
                  {tx("Sem recomendações disponíveis. Importe mais itens no Admin.", "No recommendations available. Import more items in Admin.")}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="td2-heading text-lg font-semibold">{build.data?.name ?? tx("Build", "Build")}</div>
          <div className="text-xs td2-subheading">{tx("Editor de build (resumo de marcas/sets/cores/talentos)", "Build editor (brands/sets/cores/talents summary)")}</div>
        </div>
        <button
          onClick={() => createBuild.mutate()}
          disabled={!me || createBuild.isPending}
          className="td2-btn text-xs px-3 py-2"
        >
          {createBuild.isPending ? tx("Criando...", "Creating...") : tx("Nova build", "New build")}
        </button>
      </div>

      {!me ? (
        <div className="td2-card rounded-2xl p-4 text-sm td2-muted">
          {tx("Faça login para criar e salvar suas builds.", "Sign in to create and save your builds.")}{" "}
          <a className="td2-link" href="/login">{tx("Entrar", "Sign in")}</a>
        </div>
      ) : null}

      {me && !buildId ? (
        <div className="td2-card rounded-2xl p-4 text-sm td2-muted">
          {tx("Crie uma build para começar a selecionar itens de gear.", "Create a build to start selecting gear items.")}
        </div>
      ) : null}

      {me && buildId ? (
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_1fr] gap-4">
        <div className="td2-card rounded-2xl overflow-hidden">
          <div className="td2-card-header px-4 py-3 font-medium text-sm td2-heading">{tx("Minhas builds", "My builds")}</div>
          <div className="p-3 space-y-2">
            {myBuilds.isLoading ? <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
            {myBuilds.isError ? <div className="text-xs text-red-300">{(myBuilds.error as any)?.message}</div> : null}
            {(myBuilds.data ?? []).length === 0 && !myBuilds.isLoading ? (
              <div className="text-xs td2-muted">{tx("Você ainda não tem builds salvas.", "You don't have any saved builds yet.")}</div>
            ) : null}
            <div className="space-y-1">
              {(myBuilds.data ?? []).map((b) => (
                <button
                  key={b.id}
                  className={`w-full text-left rounded-xl border px-3 py-2 transition ${b.id === buildId ? "border-orange-500/60 bg-orange-500/10" : "border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/55"}`}
                  onClick={() => {
                    setBuildId(b.id);
                    const next = new URLSearchParams(sp);
                    next.set("id", b.id);
                    setSp(next);
                  }}
                >
                  <div className="text-sm font-medium">{b.name}</div>
                  <div className="text-[11px] td2-muted">
                    {tx("Atualizado", "Updated")}: {new Date(b.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="td2-card rounded-2xl overflow-hidden">
          <div className="td2-card-header px-4 py-3 font-medium text-sm td2-heading">{tx("Slots de Gear", "Gear Slots")}</div>
          <div className="p-4 space-y-3">
            {SLOTS.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className="w-28 text-sm">{s}</div>
                <select
                  value={slotValue(s)}
                  onChange={(e) => onChangeSlot(s, e.target.value)}
                  disabled={updateBuild.isPending}
                  className="td2-select flex-1 px-3 py-2 text-sm"
                >
                  <option value="">{tx("(vazio)", "(empty)")}</option>
                  {(optionsBySlot[s] ?? []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.id})
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {gearOptions.isError ? (
              <div className="text-sm text-red-300">{tx("Erro do catálogo", "Catalog error")}: {(gearOptions.error as any)?.message}</div>
            ) : null}
            <div className="text-xs td2-muted">
              {tx("Se os dropdowns estiverem vazios, importe seu XLSX no", "If the dropdowns are empty, import your XLSX on")} <span className="text-slate-200">Admin</span>.
            </div>
            {updateBuild.isPending ? <div className="text-xs td2-muted">{tx("Salvando slot...", "Saving slot...")}</div> : null}
          </div>
        </div>

        <div className="td2-card rounded-2xl overflow-hidden">
          <div className="td2-card-header px-4 py-3 font-medium text-sm td2-heading">{tx("Resumo", "Summary")}</div>
          <div className="p-4 space-y-4">
            {summary.isLoading ? (
              <div className="text-sm td2-muted">{tx("Carregando resumo...", "Loading summary...")}</div>
            ) : summary.isError ? (
              <div className="text-sm text-red-300">{tx("Erro", "Error")}: {(summary.error as any)?.message}</div>
            ) : (
              <>
                <div className="flex gap-2 text-xs">
                  <span className="td2-chip px-2 py-1">{tx("Vermelho", "Red")}: {summary.data?.coreCounts.red ?? 0}</span>
                  <span className="td2-chip px-2 py-1">{tx("Azul", "Blue")}: {summary.data?.coreCounts.blue ?? 0}</span>
                  <span className="td2-chip px-2 py-1">{tx("Amarelo", "Yellow")}: {summary.data?.coreCounts.yellow ?? 0}</span>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">{tx("Marcas", "Brands")}</div>
                  <div className="space-y-2">
                    {(summary.data?.brands ?? []).map((b, idx) => (
                      <div key={idx} className="text-xs border border-slate-800/70 rounded-lg p-2 bg-slate-900/40">
                        <div className="font-semibold">{b.name} — {b.pieces} {tx("peças", "pcs")}</div>
                        {b.bonusesActive.length ? (
                          <ul className="list-disc pl-5 text-slate-300 mt-1">
                            {b.bonusesActive.map((x, i) => <li key={i}>{x}</li>)}
                          </ul>
                        ) : <div className="td2-muted">{tx("Sem bônus (precisa >=1)", "No bonuses (need >=1)")}</div>}
                      </div>
                    ))}
                    {(summary.data?.brands?.length ?? 0) === 0 ? <div className="text-xs td2-muted">{tx("Sem marcas ainda.", "No brands yet.")}</div> : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">{tx("Gear Sets", "Gear Sets")}</div>
                  <div className="space-y-2">
                    {(summary.data?.gearSets ?? []).map((b, idx) => (
                      <div key={idx} className="text-xs border border-slate-800/70 rounded-lg p-2 bg-slate-900/40">
                        <div className="font-semibold">{b.name} — {b.pieces} {tx("peças", "pcs")}</div>
                        {b.bonusesActive.length ? (
                          <ul className="list-disc pl-5 text-slate-300 mt-1">
                            {b.bonusesActive.map((x, i) => <li key={i}>{x}</li>)}
                          </ul>
                        ) : <div className="td2-muted">{tx("Sem bônus (precisa >=2)", "No bonuses (need >=2)")}</div>}
                      </div>
                    ))}
                    {(summary.data?.gearSets?.length ?? 0) === 0 ? <div className="text-xs td2-muted">{tx("Sem gear sets ainda.", "No gear sets yet.")}</div> : null}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">{tx("Talentos (dos itens selecionados)", "Talents (from selected items)")}</div>
                  <div className="space-y-2">
                    {(summary.data?.talents ?? []).map((t, idx) => (
                      <div key={idx} className="text-xs border border-slate-800/70 rounded-lg p-2 bg-slate-900/40">
                        <div className="font-semibold">{t.name} <span className="td2-muted">({t.type})</span></div>
                        {t.description ? <div className="text-slate-300 mt-1">{t.description}</div> : <div className="td2-muted">{tx("Sem descrição", "No description")}</div>}
                      </div>
                    ))}
                    {(summary.data?.talents?.length ?? 0) === 0 ? <div className="text-xs td2-muted">{tx("Sem talentos ainda.", "No talents yet.")}</div> : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {buildId && updateBuild.isError ? (
        <div className="text-sm text-red-300">{tx("Erro ao atualizar", "Update error")}: {(updateBuild.error as any)?.message}</div>
      ) : null}
    </div>
  );
}
