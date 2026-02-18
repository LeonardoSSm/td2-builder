import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../api/http";
import { useI18n } from "../../i18n";

type FarmMap = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  centerX: number; // 0..1
  centerY: number; // 0..1
  zoom: number; // 0.25..4
};

type FarmArea = {
  id: string;
  mapId: string;
  title: string;
  description?: string | null;
  itemType?: string | null;
  itemRef?: string | null;
  x: number; // 0..1
  y: number; // 0..1
  radiusPx: number;
  color: string;
};

type AreasResponse = { map: FarmMap; areas: FarmArea[] };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function norm(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

export default function MapPage() {
  const { tx } = useI18n();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

  const [selectedSlug, setSelectedSlug] = useState<string>("dc");
  const [q, setQ] = useState("");
  const [itemType, setItemType] = useState<string>("");

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px
  const drag = useRef<{ on: boolean; x: number; y: number; ox: number; oy: number }>({ on: false, x: 0, y: 0, ox: 0, oy: 0 });
  const [imgAspect, setImgAspect] = useState<number | null>(null); // w/h

  const MIN_SCALE = 1; // lock to image bounds (no "zoom out" that reveals background)
  const MAX_SCALE = 3.25;

  const clampOffset = (ox: number, oy: number, s: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return { x: ox, y: oy };
    const r = wrap.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    // World is same size as wrap at scale=1. After scaling, ensure it still covers the viewport.
    const minX = w - w * s;
    const minY = h - h * s;
    return {
      x: clamp(ox, minX, 0),
      y: clamp(oy, minY, 0),
    };
  };

  const maps = useQuery({
    queryKey: ["maps"],
    queryFn: () => apiGet<FarmMap[]>("/maps"),
  });

  const areas = useQuery({
    queryKey: ["map-areas", selectedSlug],
    queryFn: () => apiGet<AreasResponse>(`/maps/${selectedSlug}/areas`),
    enabled: Boolean(selectedSlug),
  });

  const dbNotReadyMsg = useMemo(() => {
    const msg = String((maps.error as any)?.message ?? (areas.error as any)?.message ?? "");
    if (!msg) return "";
    if (msg.includes("Maps tables are missing")) {
      return tx(
        "O banco ainda não tem as migrations do módulo de mapas. Rode no servidor: cd /var/www/td2-builder && npm -w apps/api run prisma:migrate",
        "Database is missing maps migrations. Run on the server: cd /var/www/td2-builder && npm -w apps/api run prisma:migrate",
      );
    }
    return "";
  }, [maps.error, areas.error, tx]);

  const effectiveMap = areas.data?.map ?? (maps.data ?? []).find((m) => m.slug === selectedSlug) ?? null;
  const allAreas = areas.data?.areas ?? [];

  const filteredAreas = useMemo(() => {
    const qq = norm(q);
    const tt = norm(itemType);
    return allAreas.filter((a) => {
      if (tt && norm(a.itemType ?? "") !== tt) return false;
      if (!qq) return true;
      const hay = `${a.title} ${a.description ?? ""} ${a.itemType ?? ""} ${a.itemRef ?? ""}`;
      return norm(hay).includes(qq);
    });
  }, [allAreas, q, itemType]);

  // Initialize viewport from map settings.
  useEffect(() => {
    if (!effectiveMap) return;
    const s = clamp(Number(effectiveMap.zoom ?? 1) || 1, MIN_SCALE, MAX_SCALE);
    setScale(s);
    setOffset({ x: 0, y: 0 });
  }, [effectiveMap?.id]);

  const centerOn = (x01: number, y01: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const x = clamp(x01, 0, 1) * w;
    const y = clamp(y01, 0, 1) * h;
    // We translate the "world" by offset and then scale it, so to center a point we solve for offset.
    const ox = w / 2 - x * scale;
    const oy = h / 2 - y * scale;
    const clamped = clampOffset(ox, oy, scale);
    setOffset({ x: Math.round(clamped.x), y: Math.round(clamped.y) });
  };

  const onWheel = (e: React.WheelEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const dir = e.deltaY > 0 ? -1 : 1;
    const factor = dir > 0 ? 1.12 : 1 / 1.12;

    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    // Keep cursor anchored: compute world coordinate under cursor before/after.
    const wx = (cx - offset.x) / scale;
    const wy = (cy - offset.y) / scale;
    const nx = cx - wx * next;
    const ny = cy - wy * next;
    setScale(next);
    setOffset(clampOffset(nx, ny, next));
  };

  const onDown = (e: React.MouseEvent) => {
    drag.current = { on: true, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current.on) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setOffset(clampOffset(drag.current.ox + dx, drag.current.oy + dy, scale));
  };
  const onUp = () => {
    drag.current.on = false;
  };

  const mapImageUrl = useMemo(() => {
    const raw = String(effectiveMap?.imageUrl ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("/")) return `${apiBase}${raw}`;
    return raw;
  }, [effectiveMap?.imageUrl, apiBase]);

  // Derive the board aspect ratio from the actual image so the viewport matches the map image size.
  // This avoids large "empty" space around the map when the viewport ratio differs from the image.
  useEffect(() => {
    let cancelled = false;
    if (!mapImageUrl) {
      setImgAspect(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = Number((img as any).naturalWidth ?? 0) || 0;
      const h = Number((img as any).naturalHeight ?? 0) || 0;
      if (w > 0 && h > 0) setImgAspect(w / h);
      else setImgAspect(null);
    };
    img.onerror = () => {
      if (cancelled) return;
      setImgAspect(null);
    };
    img.src = mapImageUrl;
    return () => {
      cancelled = true;
    };
  }, [mapImageUrl]);

  // Keep offset clamped when the board resizes (prevents showing background around the image).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setOffset((cur) => clampOffset(cur.x, cur.y, scale));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  return (
    <div className="td2-page space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="td2-heading text-lg font-semibold">{tx("Mapa de Farm / Loot", "Farm / Loot Map")}</div>
          <div className="text-xs td2-subheading">
            {tx("Marque áreas de loot/farm por item e compartilhe rotas.", "Mark loot/farm areas by item and share routes.")}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("Buscar (item, nome, etc.)", "Search (item, name, etc.)")}
            className="td2-input px-3 py-2 text-sm"
          />
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="td2-select px-3 py-2 text-sm"
          >
            <option value="">{tx("Todos", "All")}</option>
            <option value="Brand">Brand</option>
            <option value="GearSet">GearSet</option>
            <option value="WeaponClass">{tx("Classe de arma", "Weapon class")}</option>
            <option value="Item">{tx("Item", "Item")}</option>
            <option value="Route">{tx("Rota", "Route")}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,1fr)] gap-6 items-start">
        <div className="td2-card rounded-2xl p-3">
          {dbNotReadyMsg ? (
            <div className="text-xs text-red-300 mb-3">{dbNotReadyMsg}</div>
          ) : null}
          <div
            ref={wrapRef}
            className={`td2-board ${drag.current.on ? "td2-board--dragging" : ""}`}
            style={imgAspect ? ({ aspectRatio: `${imgAspect}` } as any) : undefined}
            onWheel={onWheel}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          >
            <div
              className="td2-board__world"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                backgroundImage: mapImageUrl ? `url(${mapImageUrl})` : undefined,
              }}
            >
              {filteredAreas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="td2-board__area"
                  style={{
                    left: `${clamp(a.x, 0, 1) * 100}%`,
                    top: `${clamp(a.y, 0, 1) * 100}%`,
                    width: `${Math.max(12, (a.radiusPx ?? 60) * 2)}px`,
                    height: `${Math.max(12, (a.radiusPx ?? 60) * 2)}px`,
                    color: a.color || "red",
                  }}
                  title={a.title}
                  onClick={() => centerOn(a.x, a.y)}
                >
                  <span className="td2-board__areaDot" />
                  <span className="td2-board__tooltip">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.itemType || a.itemRef ? (
                      <div className="text-xs td2-muted mt-1">
                        {a.itemType ? <span className="font-mono">{a.itemType}</span> : null}
                        {a.itemRef ? <span className="ml-2">{a.itemRef}</span> : null}
                      </div>
                    ) : null}
                    {a.description ? <div className="text-xs mt-2">{a.description}</div> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="td2-btn px-3 py-2 text-sm"
              onClick={() => {
                setScale(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              {tx("Reset", "Reset")}
            </button>
            {effectiveMap ? (
              <button type="button" className="td2-btn px-3 py-2 text-sm" onClick={() => centerOn(effectiveMap.centerX ?? 0.5, effectiveMap.centerY ?? 0.5)}>
                {tx("Centralizar mapa", "Center map")}
              </button>
            ) : null}
            <span className="text-xs td2-muted">
              {tx("Zoom com scroll. Arraste para mover.", "Scroll to zoom. Drag to pan.")} ({tx("zoom", "zoom")} {scale.toFixed(2)})
            </span>
          </div>
        </div>

        <aside className="td2-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{tx("Locais", "Locations")}</div>
            <div className="text-xs td2-muted">{filteredAreas.length} {tx("itens", "items")}</div>
          </div>

          {areas.isError ? (
            <div className="text-xs text-red-300">
              {tx("Erro ao carregar áreas.", "Failed to load areas.")} {(areas.error as any)?.message}
            </div>
          ) : null}

          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {filteredAreas.map((a) => (
              <button
                key={a.id}
                type="button"
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2 hover:border-orange-500/40 transition"
                onClick={() => centerOn(a.x, a.y)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold truncate">{a.title}</div>
                  <span className="text-[11px] td2-muted">{a.radiusPx}px</span>
                </div>
                {a.itemType || a.itemRef ? (
                  <div className="text-xs td2-muted mt-1 truncate">
                    {a.itemType ? <span className="font-mono">{a.itemType}</span> : null}
                    {a.itemRef ? <span className="ml-2">{a.itemRef}</span> : null}
                  </div>
                ) : null}
              </button>
            ))}
            {!filteredAreas.length ? (
              <div className="text-xs td2-muted">
                {tx("Nenhum local encontrado com esses filtros.", "No locations found for these filters.")}
              </div>
            ) : null}
          </div>

          <div className="text-[11px] td2-muted">
            {tx("Os círculos representam áreas de loot/farm. Para adicionar, use o painel Admin.", "Circles represent loot/farm areas. To add new ones, use the Admin panel.")}
          </div>
        </aside>
      </div>
    </div>
  );
}
