import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from "../../api/http";
import { useI18n } from "../../i18n";
import ComboBox from "../../components/ComboBox";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

type FarmMap = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  centerX: number;
  centerY: number;
  zoom: number;
};

type FarmArea = {
  id: string;
  mapId: string;
  title: string;
  description?: string | null;
  itemType?: string | null;
  itemRef?: string | null;
  x: number;
  y: number;
  radiusPx: number;
  color: string;
};

type AreasResponse = { map: FarmMap; areas: FarmArea[] };

type Brand = { id: string; name: string };
type GearSet = { id: string; name: string };
type CatalogItem = { id: string; name: string; slot?: string; rarity?: string; class?: string };

export default function AdminMapsPage() {
  const { tx } = useI18n();
  const qc = useQueryClient();
  const headers = useMemo(() => undefined, []);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [draftPicked, setDraftPicked] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const dragRef = useRef<{ on: boolean; mode: "draft" | "area"; id?: string }>({ on: false, mode: "draft" });
  const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

  const maps = useQuery({
    queryKey: ["admin-maps"],
    queryFn: () => apiGet<FarmMap[]>("/admin/maps", headers),
  });

  const [selectedSlug, setSelectedSlug] = useState<string>("dc");

  const areas = useQuery({
    queryKey: ["admin-map-areas", selectedSlug],
    queryFn: () => apiGet<AreasResponse>(`/admin/maps/${selectedSlug}/areas`, headers),
    enabled: Boolean(selectedSlug),
  });

  const map = areas.data?.map ?? (maps.data ?? []).find((m) => m.slug === selectedSlug) ?? null;
  const mapImageUrl = useMemo(() => {
    const raw = String(map?.imageUrl ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("/")) return `${apiBase}${raw}`;
    return raw;
  }, [map?.imageUrl, apiBase]);

  const [newMap, setNewMap] = useState<Partial<FarmMap>>({
    slug: "",
    name: "",
    imageUrl: "",
    centerX: 0.5,
    centerY: 0.5,
    zoom: 1,
  });

  const [areaForm, setAreaForm] = useState<Partial<FarmArea>>({
    title: "",
    description: "",
    itemType: "Item",
    itemRef: "",
    x: 0.5,
    y: 0.5,
    radiusPx: 60,
    color: "red",
  });

  const createMap = useMutation({
    mutationFn: (payload: any) => apiPost<FarmMap>("/admin/maps", payload, headers),
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["admin-maps"] });
      if (saved?.slug) setSelectedSlug(saved.slug);
      setNewMap({ slug: "", name: "", imageUrl: saved.imageUrl ?? "", centerX: saved.centerX, centerY: saved.centerY, zoom: saved.zoom });
    },
  });

  const updateMap = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiPut<FarmMap>(`/admin/maps/${id}`, payload, headers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-maps"] });
      await qc.invalidateQueries({ queryKey: ["admin-map-areas", selectedSlug] });
    },
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!map?.id) throw new Error("Select a map first");
      return apiUpload<FarmMap>(`/admin/maps/${map.id}/image`, file, headers);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-maps"] });
      await qc.invalidateQueries({ queryKey: ["admin-map-areas", selectedSlug] });
    },
  });

  const dbNotReadyMsg = useMemo(() => {
    const msg = String((maps.error as any)?.message ?? "");
    if (!msg) return "";
    if (msg.includes("Maps tables are missing")) {
      return tx(
        "Banco sem migrations do módulo de mapas. Rode: cd /var/www/td2-builder && npm -w apps/api run prisma:migrate",
        "Database missing maps migrations. Run: cd /var/www/td2-builder && npm -w apps/api run prisma:migrate",
      );
    }
    return "";
  }, [maps.error, tx]);

  const createArea = useMutation({
    mutationFn: (payload: any) => apiPost<FarmArea>(`/admin/maps/${map?.id}/areas`, payload, headers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-map-areas", selectedSlug] });
      setAreaForm((c) => ({ ...c, title: "", description: "", itemRef: "" }));
      setItemRefText("");
      setEditingAreaId(null);
      setDraftPicked(false);
    },
  });

  const updateArea = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiPut<FarmArea>(`/admin/maps/areas/${id}`, payload, headers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-map-areas", selectedSlug] });
    },
  });

  const deleteArea = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/maps/areas/${id}`, headers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-map-areas", selectedSlug] });
    },
  });

  const [uiError, setUiError] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>("");
  const [itemRefText, setItemRefText] = useState<string>("");
  const [itemRefSearch, setItemRefSearch] = useState<string>("");

  // Debounce to avoid hammering the API while typing.
  useEffect(() => {
    const t = window.setTimeout(() => setItemRefSearch(itemRefText.trim()), 200);
    return () => window.clearTimeout(t);
  }, [itemRefText]);

  const brands = useQuery({
    queryKey: ["catalog-brands-for-maps"],
    queryFn: () => apiGet<Brand[]>("/catalog/brands"),
  });
  const gearSets = useQuery({
    queryKey: ["catalog-gear-sets-for-maps"],
    queryFn: () => apiGet<GearSet[]>("/catalog/gear-sets"),
  });

  const gearItems = useQuery({
    queryKey: ["catalog-gear-items-for-maps", itemRefSearch],
    queryFn: () => apiGet<{ total: number; items: CatalogItem[] }>(`/catalog/gear-items?take=25&q=${encodeURIComponent(itemRefSearch)}`),
    enabled: (areaForm.itemType ?? "Item") === "Item" && itemRefSearch.length >= 1,
  });
  const weapons = useQuery({
    queryKey: ["catalog-weapons-for-maps", itemRefSearch],
    queryFn: () => apiGet<{ total: number; items: CatalogItem[] }>(`/catalog/weapons?take=25&q=${encodeURIComponent(itemRefSearch)}`),
    enabled: (areaForm.itemType ?? "Item") === "Item" && itemRefSearch.length >= 1,
  });

  const clampRadius = (n: number) => clamp(Number.isFinite(n) ? n : 60, 6, 600);
  const setRadius = (n: number) => setAreaForm((c) => ({ ...c, radiusPx: clampRadius(n) }));

  const setXYFromEvent = (e: React.MouseEvent) => {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const y = clamp((e.clientY - r.top) / r.height, 0, 1);
    setAreaForm((c) => ({ ...c, x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) }));
  };

  const startDraft = () => {
    setDraftPicked(true);
    // Focus title so the flow becomes: click map -> type title -> save.
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Mapa", "Admin Map")}</div>
        <div className="text-xs td2-subheading">
          {tx("Cadastre áreas de farm/loot e vincule a itens. Elas aparecem no mapa público.", "Create farm/loot areas and link them to items. They show up on the public map.")}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="td2-card rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold">{tx("Mapas", "Maps")}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="td2-select px-3 py-2 text-sm"
              disabled={maps.isLoading || !(maps.data ?? []).length}
            >
              {(maps.data ?? []).map((m) => (
                <option key={m.id} value={m.slug}>{m.name}</option>
              ))}
              {!(maps.data ?? []).length ? <option value="dc">{tx("Carregando...", "Loading...")}</option> : null}
            </select>

            {map ? (
              <button
                className="td2-btn px-3 py-2 text-sm"
                onClick={() => updateMap.mutate({ id: map.id, payload: { ...map } })}
                disabled={updateMap.isPending}
              >
                {updateMap.isPending ? tx("Salvando...", "Saving...") : tx("Salvar ajustes do mapa", "Save map settings")}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newMap.slug ?? ""} onChange={(e) => setNewMap((c) => ({ ...c, slug: e.target.value }))} placeholder="slug (ex: dc, ny)" className="td2-input px-3 py-2 text-sm" />
            <input value={newMap.name ?? ""} onChange={(e) => setNewMap((c) => ({ ...c, name: e.target.value }))} placeholder={tx("Nome do mapa", "Map name")} className="td2-input px-3 py-2 text-sm" />
            <input value={String(newMap.centerX ?? 0.5)} onChange={(e) => setNewMap((c) => ({ ...c, centerX: Number(e.target.value) }))} placeholder="centerX (0..1)" className="td2-input px-3 py-2 text-sm" />
            <input value={String(newMap.centerY ?? 0.5)} onChange={(e) => setNewMap((c) => ({ ...c, centerY: Number(e.target.value) }))} placeholder="centerY (0..1)" className="td2-input px-3 py-2 text-sm" />
            <input value={String(newMap.zoom ?? 1)} onChange={(e) => setNewMap((c) => ({ ...c, zoom: Number(e.target.value) }))} placeholder="zoom (0.25..4)" className="td2-input px-3 py-2 text-sm" />
            <input value={String(newMap.imageUrl ?? "")} onChange={(e) => setNewMap((c) => ({ ...c, imageUrl: e.target.value }))} placeholder={tx("URL da imagem do mapa (opcional)", "Map image URL (optional)")} className="td2-input px-3 py-2 text-sm md:col-span-2" />
            <button
              className="td2-btn px-3 py-2 text-sm"
              onClick={() => {
                setUiError(null);
                const slug = String(newMap.slug ?? "").trim();
                const name = String(newMap.name ?? "").trim();
                if (!slug || !name) {
                  setUiError(tx("Informe slug e nome do mapa.", "Provide map slug and name."));
                  return;
                }
                createMap.mutate(newMap, {
                  onError: (e: any) => setUiError(String(e?.message ?? e)),
                });
              }}
              disabled={createMap.isPending}
            >
              {createMap.isPending ? tx("Criando...", "Creating...") : tx("Criar novo mapa", "Create map")}
            </button>
          </div>

          {maps.isError ? (
            <div className="space-y-2">
              <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(maps.error as any)?.message}</div>
              {dbNotReadyMsg ? <div className="text-xs td2-muted">{dbNotReadyMsg}</div> : null}
            </div>
          ) : null}
          {uiError ? <div className="text-xs text-red-300">{uiError}</div> : null}
        </div>

        <div className="td2-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{tx("Áreas (círculos)", "Areas (circles)")}</div>
            <div className="text-xs td2-muted">{(areas.data?.areas ?? []).length} {tx("cadastros", "records")}</div>
          </div>

          {!map ? (
            <div className="text-xs td2-muted">{tx("Selecione um mapa.", "Select a map.")}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
                <div className="td2-panel rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-xs td2-muted">
                      {tx("Clique no mapa para definir a posição (x/y).", "Click the map to set position (x/y).")}
                    </div>
                    <button
                      type="button"
                      className="td2-btn px-3 py-2 text-sm"
                      onClick={() => setPickMode((v) => !v)}
                    >
                      {pickMode ? tx("Modo clique: ON", "Click mode: ON") : tx("Modo clique: OFF", "Click mode: OFF")}
                    </button>
                  </div>

                  <div
                    ref={boardRef}
                    className={`td2-board td2-board--admin ${pickMode ? "td2-board--pick" : ""}`}
                    onClick={(e) => {
                      if (!pickMode) return;
                      // If clicking on a circle, let its handler run.
                      if ((e.target as any)?.closest?.(".td2-board__area")) return;
                      setEditingAreaId(null);
                      setXYFromEvent(e);
                      startDraft();
                    }}
                    onWheel={(e) => {
                      if (!pickMode) return;
                      if (!draftPicked && !editingAreaId) return;
                      e.preventDefault();
                      const dir = e.deltaY > 0 ? -1 : 1;
                      const step = e.shiftKey ? 20 : 6;
                      setRadius(Number(areaForm.radiusPx ?? 60) + dir * step);
                    }}
                    onMouseMove={(e) => {
                      if (!dragRef.current.on) return;
                      if (dragRef.current.mode === "draft") {
                        setXYFromEvent(e);
                      }
                    }}
                    onMouseUp={() => {
                      dragRef.current.on = false;
                    }}
                    onMouseLeave={() => {
                      dragRef.current.on = false;
                    }}
                  >
                    <div
                      className="td2-board__world td2-board__world--static"
                      style={{
                        backgroundImage: mapImageUrl ? `url(${mapImageUrl})` : undefined,
                        transform: "translate(0px, 0px) scale(1)",
                      }}
                    >
                      {(areas.data?.areas ?? []).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className={`td2-board__area td2-board__area--static ${editingAreaId === a.id ? "td2-board__area--selected" : ""}`}
                          style={{
                            left: `${clamp(a.x, 0, 1) * 100}%`,
                            top: `${clamp(a.y, 0, 1) * 100}%`,
                            width: `${Math.max(12, (a.radiusPx ?? 60) * 2)}px`,
                            height: `${Math.max(12, (a.radiusPx ?? 60) * 2)}px`,
                            color: a.color || "red",
                          }}
                          title={a.title}
                          onClick={() => {
                            setEditingAreaId(a.id);
                            setDraftPicked(false);
                            setAreaForm({
                              title: a.title,
                              description: a.description ?? "",
                              itemType: a.itemType ?? "Item",
                              itemRef: a.itemRef ?? "",
                              x: a.x,
                              y: a.y,
                              radiusPx: a.radiusPx ?? 60,
                              color: a.color ?? "red",
                            });
                            setItemRefText(String(a.itemRef ?? ""));
                            setTimeout(() => titleRef.current?.focus(), 0);
                          }}
                        >
                          <span className="td2-board__areaDot" />
                        </button>
                      ))}

                      {draftPicked || Boolean(editingAreaId) ? (
                        <button
                          type="button"
                          className="td2-board__area td2-board__area--static td2-board__area--draft"
                          style={{
                            left: `${clamp(Number(areaForm.x ?? 0.5), 0, 1) * 100}%`,
                            top: `${clamp(Number(areaForm.y ?? 0.5), 0, 1) * 100}%`,
                            width: `${Math.max(12, (Number(areaForm.radiusPx ?? 60) || 60) * 2)}px`,
                            height: `${Math.max(12, (Number(areaForm.radiusPx ?? 60) || 60) * 2)}px`,
                            color: String(areaForm.color ?? "red"),
                          }}
                          title={tx("Arraste para mover. Scroll ajusta o raio. Shift+Scroll = passo maior.", "Drag to move. Scroll changes radius. Shift+Scroll = bigger step.")}
                          onMouseDown={(e) => {
                            if (!pickMode) return;
                            e.preventDefault();
                            e.stopPropagation();
                            dragRef.current = { on: true, mode: "draft" };
                          }}
                        >
                          <span className="td2-board__areaDot" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="td2-panel rounded-2xl p-3">
                    <div className="text-xs td2-muted mb-2">{tx("Imagem do mapa", "Map image")}</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      className="hidden"
                      onChange={(e) => {
                        setUiError(null);
                        const f = e.target.files?.[0];
                        setSelectedImageName(f?.name ?? "");
                        if (f) {
                          uploadImage.mutate(f, {
                            onError: (err: any) => setUiError(String(err?.message ?? err)),
                            onSuccess: () => {
                              // Allow selecting the same file again later.
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            },
                          });
                        }
                      }}
                      disabled={!map?.id || uploadImage.isPending}
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          className="td2-btn px-3 py-2 text-sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!map?.id || uploadImage.isPending}
                        >
                          {tx("Selecionar imagem", "Choose image")}
                        </button>
                        <div className="td2-input px-3 py-2 text-sm min-w-0 flex-1">
                          <span className="block truncate">
                            {selectedImageName || tx("Nenhum arquivo selecionado", "No file selected")}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] td2-muted">
                        {uploadImage.isPending ? tx("Enviando...", "Uploading...") : tx("PNG/JPG/WebP/AVIF até 12MB.", "PNG/JPG/WebP/AVIF up to 12MB.")}
                      </div>
                    </div>
                    <div className="text-[11px] td2-muted mt-2">
                      {tx("Ao selecionar um arquivo, o upload é feito automaticamente.", "When you pick a file, the upload starts automatically.")}
                    </div>
                    {mapImageUrl ? (
                      <div className="text-[11px] td2-muted mt-2">
                        {tx("Atual:", "Current:")} <code className="td2-code px-2 py-1">{mapImageUrl}</code>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      ref={titleRef}
                      value={areaForm.title ?? ""}
                      onChange={(e) => setAreaForm((c) => ({ ...c, title: e.target.value }))}
                      placeholder={tx("Título (obrigatório)", "Title (required)")}
                      className="td2-input px-3 py-2 text-sm"
                    />
                    <select
                      value={areaForm.itemType ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAreaForm((c) => ({ ...c, itemType: next, itemRef: "" }));
                        setItemRefText("");
                      }}
                      className="td2-select px-3 py-2 text-sm"
                    >
                      <option value="Item">{tx("Item", "Item")}</option>
                      <option value="Brand">Brand</option>
                      <option value="GearSet">GearSet</option>
                      <option value="WeaponClass">{tx("Classe de arma", "Weapon class")}</option>
                      <option value="Route">{tx("Rota", "Route")}</option>
                    </select>
                    {String(areaForm.itemType ?? "Item") === "WeaponClass" ? (
                      <select
                        value={String(areaForm.itemRef ?? "")}
                        onChange={(e) => {
                          setAreaForm((c) => ({ ...c, itemRef: e.target.value }));
                          setItemRefText(e.target.value);
                        }}
                        className="td2-select px-3 py-2 text-sm"
                      >
                        <option value="">{tx("Classe (opcional)", "Class (optional)")}</option>
                        <option value="AR">AR</option>
                        <option value="SMG">SMG</option>
                        <option value="LMG">LMG</option>
                        <option value="Rifle">Rifle</option>
                        <option value="MMR">MMR</option>
                        <option value="Shotgun">Shotgun</option>
                        <option value="Pistol">Pistol</option>
                      </select>
                    ) : String(areaForm.itemType ?? "Item") === "Brand" ? (
                      <ComboBox
                        value={itemRefText}
                        onChange={(next) => {
                          setItemRefText(next);
                          const q = next.trim().toLowerCase();
                          const found = (brands.data ?? []).find((b) => b.name.toLowerCase() === q || b.id.toLowerCase() === q);
                          setAreaForm((c) => ({ ...c, itemRef: found?.id ?? "" }));
                        }}
                        onPick={(opt) => {
                          setItemRefText(opt.label);
                          setAreaForm((c) => ({ ...c, itemRef: opt.id }));
                        }}
                        options={(brands.data ?? []).map((b) => ({ id: b.id, label: `${b.name} (${b.id})`, keywords: b.id }))}
                        placeholder={tx("Marca (buscar por nome)", "Brand (search by name)")}
                        className="td2-input px-3 py-2 text-sm w-full"
                        disabled={brands.isLoading}
                      />
                    ) : String(areaForm.itemType ?? "Item") === "GearSet" ? (
                      <ComboBox
                        value={itemRefText}
                        onChange={(next) => {
                          setItemRefText(next);
                          const q = next.trim().toLowerCase();
                          const found = (gearSets.data ?? []).find((s) => s.name.toLowerCase() === q || s.id.toLowerCase() === q);
                          setAreaForm((c) => ({ ...c, itemRef: found?.id ?? "" }));
                        }}
                        onPick={(opt) => {
                          setItemRefText(opt.label);
                          setAreaForm((c) => ({ ...c, itemRef: opt.id }));
                        }}
                        options={(gearSets.data ?? []).map((s) => ({ id: s.id, label: `${s.name} (${s.id})`, keywords: s.id }))}
                        placeholder={tx("Gear Set (buscar por nome)", "Gear Set (search by name)")}
                        className="td2-input px-3 py-2 text-sm w-full"
                        disabled={gearSets.isLoading}
                      />
                    ) : String(areaForm.itemType ?? "Item") === "Item" ? (
                      <ComboBox
                        value={itemRefText}
                        onChange={(next) => {
                          setItemRefText(next);
                          // Allow typing; if not picked, itemRef remains empty until selection.
                        }}
                        onPick={(opt) => {
                          setItemRefText(opt.label);
                          setAreaForm((c) => ({ ...c, itemRef: opt.id }));
                        }}
                        options={[
                          ...(gearItems.data?.items ?? []).map((it) => ({ id: it.id, label: `Gear: ${it.name} (${it.id})`, keywords: it.name })),
                          ...(weapons.data?.items ?? []).map((it) => ({ id: it.id, label: `Weapon: ${it.name} (${it.id})`, keywords: it.name })),
                        ]}
                        placeholder={tx("Item (busque por nome e selecione)", "Item (search by name and pick)")}
                        className="td2-input px-3 py-2 text-sm w-full"
                        disabled={gearItems.isLoading || weapons.isLoading}
                      />
                    ) : (
                      <input
                        value={areaForm.itemRef ?? ""}
                        onChange={(e) => setAreaForm((c) => ({ ...c, itemRef: e.target.value }))}
                        placeholder={tx("Item ref (ex: Striker, AR, Belstone)", "Item ref (e.g. Striker, AR, Belstone)")}
                        className="td2-input px-3 py-2 text-sm"
                      />
                    )}
                    <input value={areaForm.description ?? ""} onChange={(e) => setAreaForm((c) => ({ ...c, description: e.target.value }))} placeholder={tx("Descrição (opcional)", "Description (optional)")} className="td2-input px-3 py-2 text-sm" />
                    <input value={String(areaForm.x ?? "")} onChange={(e) => setAreaForm((c) => ({ ...c, x: Number(e.target.value) }))} placeholder="x (0..1)" className="td2-input px-3 py-2 text-sm" />
                    <input value={String(areaForm.y ?? "")} onChange={(e) => setAreaForm((c) => ({ ...c, y: Number(e.target.value) }))} placeholder="y (0..1)" className="td2-input px-3 py-2 text-sm" />
                    <div className="md:col-span-2 td2-panel rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-xs td2-muted">{tx("Raio do círculo", "Circle radius")}</div>
                        <div className="text-[11px] td2-muted font-mono">{clampRadius(Number(areaForm.radiusPx ?? 60))}px</div>
                      </div>
                      <input
                        type="range"
                        min={6}
                        max={600}
                        value={clampRadius(Number(areaForm.radiusPx ?? 60))}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => setRadius(Number(areaForm.radiusPx ?? 60) - 10)}>-10</button>
                        <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => setRadius(60)}>{tx("Padrão", "Default")}</button>
                        <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => setRadius(Number(areaForm.radiusPx ?? 60) + 10)}>+10</button>
                      </div>
                      <div className="text-[11px] td2-muted mt-2">
                        {tx("Dica: com Modo clique ON, use scroll no mapa para ajustar. Shift+Scroll = passo maior.", "Tip: with Click mode ON, use wheel over the map to adjust. Shift+Wheel = bigger step.")}
                      </div>
                    </div>
                    <select value={areaForm.color ?? "red"} onChange={(e) => setAreaForm((c) => ({ ...c, color: e.target.value }))} className="td2-select px-3 py-2 text-sm">
                      <option value="red">{tx("Vermelho", "Red")}</option>
                      <option value="orange">{tx("Laranja", "Orange")}</option>
                      <option value="yellow">{tx("Amarelo", "Yellow")}</option>
                      <option value="blue">{tx("Azul", "Blue")}</option>
                    </select>
                    <button
                      type="button"
                      className="td2-btn px-3 py-2 text-sm"
                      onClick={() => {
                        setEditingAreaId(null);
                        setDraftPicked(false);
                        setAreaForm({
                          title: "",
                          description: "",
                          itemType: "Item",
                          itemRef: "",
                          x: 0.5,
                          y: 0.5,
                          radiusPx: 60,
                          color: "red",
                        });
                      }}
                    >
                      {tx("Limpar", "Clear")}
                    </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="td2-btn px-3 py-2 text-sm"
                  onClick={() => {
                    setUiError(null);
                    if (editingAreaId) updateArea.mutate({ id: editingAreaId, payload: areaForm });
                    else {
                      createArea.mutate(areaForm, {
                        onError: (e: any) => setUiError(String(e?.message ?? e)),
                      });
                    }
                  }}
                  disabled={createArea.isPending || updateArea.isPending}
                >
                  {editingAreaId
                    ? (updateArea.isPending ? tx("Atualizando...", "Updating...") : tx("Atualizar área", "Update area"))
                    : (createArea.isPending ? tx("Criando...", "Creating...") : tx("Adicionar área", "Add area"))}
                </button>

                {editingAreaId ? (
                  <button
                    type="button"
                    className="td2-btn px-3 py-2 text-sm"
                    onClick={() => {
                      setEditingAreaId(null);
                      setDraftPicked(false);
                    }}
                  >
                    {tx("Cancelar edição", "Cancel edit")}
                  </button>
                ) : null}
              </div>
                </div>
              </div>

              {areas.isError ? <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(areas.error as any)?.message}</div> : null}
              {uiError ? <div className="text-xs text-red-300">{uiError}</div> : null}

              <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
                {(areas.data?.areas ?? []).map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{a.title}</div>
                        <div className="text-xs td2-muted truncate">
                          {a.itemType ? <span className="font-mono">{a.itemType}</span> : null}
                          {a.itemRef ? <span className="ml-2">{a.itemRef}</span> : null}
                        </div>
                        <div className="text-[11px] td2-muted font-mono mt-1">x {a.x.toFixed(3)} · y {a.y.toFixed(3)} · {a.radiusPx}px · {a.color}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="td2-btn text-[11px] px-2 py-1"
                          onClick={() => {
                            setEditingAreaId(a.id);
                            setDraftPicked(false);
                            setAreaForm({
                              title: a.title,
                              description: a.description ?? "",
                              itemType: a.itemType ?? "Item",
                              itemRef: a.itemRef ?? "",
                              x: a.x,
                              y: a.y,
                              radiusPx: a.radiusPx ?? 60,
                              color: a.color ?? "red",
                            });
                            setTimeout(() => titleRef.current?.focus(), 0);
                          }}
                        >
                          {tx("Editar", "Edit")}
                        </button>
                        <button
                          className="td2-btn td2-btn-danger text-[11px] px-2 py-1"
                          onClick={() => deleteArea.mutate(a.id)}
                          disabled={deleteArea.isPending}
                        >
                          {tx("Remover", "Remove")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!(areas.data?.areas ?? []).length ? (
                  <div className="text-xs td2-muted">{tx("Nenhuma área cadastrada ainda.", "No areas yet.")}</div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
