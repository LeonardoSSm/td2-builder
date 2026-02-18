import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiGet } from "../../api/http";
import { useI18n } from "../../i18n";
import { useAuth } from "../../auth/auth";

const MENU_ITEMS = (tx: (pt: string, en: string) => string) => [
  {
    title: tx("Catálogo", "Catalog"),
    description: tx("Pesquise máscaras, peitorais, mochilas e detalhes completos dos itens.", "Search masks, chest pieces, backpacks and full item details."),
    to: "/catalog",
    tag: tx("Explorar", "Explore"),
  },
  {
    title: tx("Build", "Build"),
    description: tx("Monte sua build por slot e veja resumo de cores, brands, sets e talentos.", "Assemble your build by slot and see core, brand, set and talent summary."),
    to: "/build",
    tag: tx("Montar", "Assemble"),
  },
  {
    title: tx("Mapa", "Map"),
    description: tx("Marque áreas de farm/loot por item e compartilhe rotas.", "Mark farm/loot areas by item and share routes."),
    to: "/map",
    tag: tx("Explorar", "Explore"),
  },
  {
    title: tx("Admin Itens", "Admin Items"),
    description: tx("Cadastre equipamentos e armas com modo rápido (MVP) e modo avançado.", "Register gear and weapons with quick mode (MVP) and advanced mode."),
    to: "/admin/items",
    tag: tx("Gerenciar", "Manage"),
    perm: "admin.items.manage" as const,
  },
  {
    title: tx("Admin Importar", "Admin Import"),
    description: tx("Importe planilha XLSX para atualizar o banco com dados em lote.", "Import XLSX sheets to update the database in bulk."),
    to: "/admin/import",
    tag: tx("Importar", "Import"),
    perm: "admin.import.run" as const,
  },
  {
    title: tx("Admin Builds", "Admin Builds"),
    description: tx("Edite os perfis de builds recomendadas e overrides por slot.", "Edit recommended build profiles and per-slot overrides."),
    to: "/admin/recommended",
    tag: tx("Configurar", "Configure"),
    perm: "admin.recommended.manage" as const,
  },
];

export default function HomePage() {
  const { tx } = useI18n();
  const { me, hasPerm } = useAuth();
  const menu = MENU_ITEMS(tx).filter((it: any) => {
    if (!it.perm) return true;
    return Boolean(me) && hasPerm(it.perm);
  });
  const recommended = useQuery({
    queryKey: ["recommended-builds-home"],
    queryFn: () =>
      apiGet<
        Array<{
          id: string;
          name: string;
          focus: "DPS" | "Tank" | "Skill";
          preferredCore: "Red" | "Blue" | "Yellow";
          filledSlots: number;
          totalSlots: number;
        }>
      >("/builds/recommended"),
  });

  return (
    <div className="td2-page space-y-6">
      <section className="td2-home-hero rounded-2xl p-6 md:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="td2-home-kicker">{tx("Plataforma de Loadouts The Division 2", "The Division 2 Loadout Platform")}</div>
          <h1 className="td2-home-title">{tx("Planeje, compare e evolua suas builds com precisão", "Plan, compare and evolve your builds with precision")}</h1>
          <p className="td2-home-copy">
            {tx("Plataforma para criação de builds, cadastro de itens e gerenciamento técnico de equipamento e armas.", "Platform for build creation, item registration and technical management of gear and weapons.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/build" className="td2-btn px-4 py-2 text-sm">{tx("Iniciar Build", "Start Build")}</Link>
          <Link to="/catalog" className="td2-btn px-4 py-2 text-sm">{tx("Ver Catálogo", "View Catalog")}</Link>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_340px] gap-4 items-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menu.map((item) => (
            <Link key={item.to} to={item.to} className="td2-home-card rounded-2xl p-5">
              <div className="td2-home-tag text-xs">{item.tag}</div>
              <h2 className="td2-heading text-lg mt-2">{item.title}</h2>
              <p className="td2-muted text-sm mt-2">{item.description}</p>
              <div className="td2-home-link text-xs mt-4">{tx("Abrir módulo", "Open module")}</div>
            </Link>
          ))}
        </div>

        <aside className="td2-card rounded-2xl overflow-hidden">
          <div className="td2-card-header px-4 py-3 flex items-center justify-between">
            <div className="td2-heading text-sm font-semibold">{tx("Builds Recomendadas", "Recommended Builds")}</div>
            <Link to="/build" className="text-[11px] td2-home-link">{tx("Ver todas", "See all")}</Link>
          </div>
          <div className="p-3 space-y-2">
            {recommended.isLoading ? <div className="text-xs td2-muted">{tx("Carregando...", "Loading...")}</div> : null}
            {recommended.isError ? (
              <div className="text-xs text-red-300">{tx("Erro", "Error")}: {(recommended.error as any)?.message}</div>
            ) : null}
            {(recommended.data ?? []).slice(0, 6).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-slate-800/70 bg-slate-900/30 p-2.5">
                <div className="text-xs font-semibold">{rec.name}</div>
                <div className="text-[11px] td2-muted mt-1">
                  {rec.focus} · {tx("Core", "Core")}: {rec.preferredCore}
                </div>
                <div className="text-[11px] td2-muted">
                  {tx("Slots", "Slots")}: {rec.filledSlots}/{rec.totalSlots}
                </div>
              </div>
            ))}
            {(recommended.data?.length ?? 0) === 0 && !recommended.isLoading ? (
              <div className="text-xs td2-muted">{tx("Sem recomendações ainda.", "No recommendations yet.")}</div>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
