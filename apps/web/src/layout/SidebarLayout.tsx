import { Link, NavLink } from "react-router-dom";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useAuth } from "../auth/auth";
import ChatWidget from "../components/ChatWidget";

type NavItem = { to: string; label: string; icon: React.ReactNode };
type NavGroup = { id: string; label: string; items: NavItem[] };

function Icon({ name }: { name: string }) {
  // Minimal inline icons (no external deps).
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const, xmlns: "http://www.w3.org/2000/svg" };
  const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path {...stroke} d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.8z" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...common}>
          <path {...stroke} d="M4 6h16M4 12h16M4 18h16" />
          <path {...stroke} d="M7 6v12" opacity="0.35" />
        </svg>
      );
    case "build":
      return (
        <svg {...common}>
          <path {...stroke} d="M4 7h10M4 17h10" />
          <path {...stroke} d="M14 7l6 0" opacity="0.35" />
          <path {...stroke} d="M14 17l6 0" opacity="0.35" />
          <path {...stroke} d="M12 7v0" />
          <path {...stroke} d="M10 17v0" />
          <path {...stroke} d="M12 7a2 2 0 1 0 0 .01" />
          <path {...stroke} d="M10 17a2 2 0 1 0 0 .01" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path {...stroke} d="M10 21l-5-2V5l5 2 4-2 5 2v14l-5-2-4 2z" />
          <path {...stroke} d="M10 7v14" opacity="0.35" />
          <path {...stroke} d="M14 5v14" opacity="0.35" />
        </svg>
      );
    case "items":
      return (
        <svg {...common}>
          <path {...stroke} d="M7 7h10v14H7z" />
          <path {...stroke} d="M9 7V5h6v2" opacity="0.35" />
          <path {...stroke} d="M9 11h6M9 15h6" opacity="0.35" />
        </svg>
      );
    case "tags":
      return (
        <svg {...common}>
          <path {...stroke} d="M20 13l-7 7-9-9V4h7l9 9z" />
          <path {...stroke} d="M7.5 7.5h.01" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3v10" />
          <path {...stroke} d="M8 9l4 4 4-4" />
          <path {...stroke} d="M4 17v3h16v-3" opacity="0.35" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3z" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path {...stroke} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <path {...stroke} d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          <path {...stroke} d="M22 21v-2a3.5 3.5 0 0 0-3-3.4" opacity="0.35" />
          <path {...stroke} d="M16.5 3.3a4 4 0 0 1 0 7.4" opacity="0.35" />
        </svg>
      );
    case "nav":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 2l4 20-4-4-4 4 4-20z" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path {...stroke} d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z" />
          <path {...stroke} d="M9 12h6" opacity="0.35" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <path {...stroke} d="M3 12h4l2-4 3 8 2-4h7" />
          <path {...stroke} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" opacity="0.35" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path {...stroke} d="M5 12h14" />
        </svg>
      );
  }
}

function ItemLink({
  to,
  label,
  collapsed,
  icon,
  onNavigate,
}: {
  to: string;
  label: string;
  collapsed: boolean;
  icon: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        `td2-side-link ${isActive ? "td2-side-link--active" : ""} ${collapsed ? "td2-side-link--collapsed" : ""}`
      }
    >
      <span className="td2-side-link__icon" aria-hidden="true">
        {icon}
      </span>
      {!collapsed ? <span className="td2-side-link__label">{label}</span> : null}
    </NavLink>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang, tx } = useI18n();
  const { me, logout, hasPerm } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = useMemo<NavGroup[]>(
    () => {
      const core: NavGroup = {
        id: "core",
        label: tx("Navegação", "Navigation"),
        items: [
          { to: "/", label: tx("Início", "Home"), icon: <Icon name="home" /> },
          { to: "/catalog", label: tx("Catálogo", "Catalog"), icon: <Icon name="catalog" /> },
          { to: "/build", label: "Build", icon: <Icon name="build" /> },
          { to: "/map", label: tx("Mapa", "Map"), icon: <Icon name="map" /> },
        ],
      };

      const adminItems: NavItem[] = [];
      if (me && hasPerm("admin.items.manage")) adminItems.push({ to: "/admin/items", label: tx("Itens", "Items"), icon: <Icon name="items" /> });
      if (me && hasPerm("admin.items.manage")) adminItems.push({ to: "/admin/catalog", label: tx("Catálogo", "Catalog"), icon: <Icon name="tags" /> });
      if (me && hasPerm("admin.import.run")) adminItems.push({ to: "/admin/import", label: tx("Importar", "Import"), icon: <Icon name="import" /> });
      if (me && hasPerm("admin.recommended.manage")) adminItems.push({ to: "/admin/recommended", label: tx("Builds Recomendadas", "Recommended Builds"), icon: <Icon name="star" /> });
      if (me && hasPerm("admin.maps.manage")) adminItems.push({ to: "/admin/maps", label: tx("Mapa (Loot/Farm)", "Map (Loot/Farm)"), icon: <Icon name="map" /> });
      if (me && hasPerm("admin.monitor.view")) adminItems.push({ to: "/admin/monitor", label: tx("Monitor", "Monitor"), icon: <Icon name="monitor" /> });
      if (me && hasPerm("admin.audit.view")) adminItems.push({ to: "/admin/audit", label: tx("Auditoria", "Audit"), icon: <Icon name="admin" /> });
      if (me && hasPerm("admin.users.manage")) adminItems.push({ to: "/admin/access", label: tx("Usuários e Permissões", "Users & Permissions"), icon: <Icon name="users" /> });

      const groups: NavGroup[] = [core];
      if (adminItems.length) {
        groups.push({ id: "admin", label: tx("Admin", "Admin"), items: adminItems });
      }
      return groups;
    },
    [tx, me, hasPerm],
  );

  return (
    <div className="td2-app">
      <div className="td2-mobile-topbar">
        <button
          className="td2-btn td2-mobile-topbar__menu"
          onClick={() => setMobileOpen(true)}
          aria-label={tx("Abrir menu", "Open menu")}
          title={tx("Abrir menu", "Open menu")}
        >
          ☰
        </button>
        <Link to="/" className="td2-brand td2-mobile-topbar__brand">
          TD2 Builder
        </Link>

        <div className="td2-mobile-topbar__right">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "pt-BR" | "en")}
            className="td2-select td2-mobile-topbar__lang"
            title={tx("Idioma", "Language")}
          >
            <option value="pt-BR">PT</option>
            <option value="en">EN</option>
          </select>
          {me ? (
            <button className="td2-btn td2-mobile-topbar__logout" onClick={logout} title={tx("Sair", "Sign out")}>
              {tx("Sair", "Out")}
            </button>
          ) : (
            <Link to="/login" className="td2-btn td2-mobile-topbar__logout">
              {tx("Entrar", "Sign in")}
            </Link>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <button
          className="td2-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          aria-label={tx("Fechar menu", "Close menu")}
        />
      ) : null}

      <aside className={`td2-sidebar ${collapsed ? "td2-sidebar--collapsed" : ""} ${mobileOpen ? "td2-sidebar--mobile-open" : ""}`}>
        <div className="td2-sidebar__top">
          <Link to="/" className="td2-brand td2-sidebar__brand">
            {collapsed ? "TD2" : "TD2 Builder"}
          </Link>
          <button
            className="td2-btn td2-sidebar__collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={tx("Recolher menu", "Collapse menu")}
            title={tx("Recolher menu", "Collapse menu")}
          >
            {collapsed ? ">" : "<"}
          </button>
          <button
            className="td2-btn td2-sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label={tx("Fechar menu", "Close menu")}
            title={tx("Fechar menu", "Close menu")}
          >
            ×
          </button>
        </div>

        <div className="td2-sidebar__content">
          {groups.map((g) => {
            const isAdmin = g.id === "admin";
            const open = !isAdmin || adminOpen;
            return (
              <div key={g.id} className="td2-side-group">
                <button
                  className={`td2-side-group__title ${collapsed ? "td2-side-group__title--collapsed" : ""}`}
                  onClick={() => (isAdmin ? setAdminOpen((v) => !v) : undefined)}
                  disabled={!isAdmin}
                  title={collapsed ? g.label : undefined}
                >
                  {!collapsed ? (
                    g.label
                  ) : (
                    <span className="td2-side-group__icon" aria-hidden="true">
                      <Icon name={g.id === "admin" ? "admin" : "nav"} />
                    </span>
                  )}
                  {isAdmin && !collapsed ? <span className="td2-side-group__chev">{open ? "v" : ">"}</span> : null}
                </button>
                {open ? (
                  <div className="td2-side-group__items">
                    {g.items.map((it) => (
                      <ItemLink
                        key={it.to}
                        to={it.to}
                        label={it.label}
                        icon={it.icon}
                        collapsed={collapsed}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="td2-sidebar__bottom">
          <div className={`mb-2 text-[11px] td2-muted ${collapsed ? "hidden" : ""}`}>
            {me ? (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{me?.name ?? tx("Logado", "Signed in")}</span>
                <button className="td2-btn text-[11px] px-2 py-1" onClick={logout}>
                  {tx("Sair", "Sign out")}
                </button>
              </div>
            ) : (
              <Link to="/login" className="td2-btn text-[11px] px-2 py-1 inline-flex">
                {tx("Entrar", "Sign in")}
              </Link>
            )}
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "pt-BR" | "en")}
            className="td2-select td2-sidebar__lang"
            title={tx("Idioma", "Language")}
          >
            <option value="pt-BR">PT</option>
            <option value="en">EN</option>
          </select>
        </div>
      </aside>

      <main className="td2-content">
        {children}
      </main>

      <ChatWidget />
    </div>
  );
}
