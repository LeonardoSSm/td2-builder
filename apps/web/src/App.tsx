import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/home";
import CatalogPage from "./pages/catalog";
import BuildPage from "./pages/build";
import MapPage from "./pages/map";
import AdminImportPage from "./pages/admin-import";
import AdminItemsPage from "./pages/admin-items";
import AdminRecommendedBuildsPage from "./pages/admin-recommended";
import AdminAccessPage from "./pages/admin-access";
import AdminCatalogPage from "./pages/admin-catalog";
import AdminMapsPage from "./pages/admin-maps";
import AdminAuditPage from "./pages/admin-audit";
import SidebarLayout from "./layout/SidebarLayout";
import { useI18n } from "./i18n";
import LoginPage from "./pages/login";
import RequireAuth from "./auth/RequireAuth";

export default function App() {
  const { tx } = useI18n();

  return (
    <SidebarLayout>
      <div className="td2-main mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/admin/items" element={<RequireAuth><AdminItemsPage /></RequireAuth>} />
          <Route path="/admin/catalog" element={<RequireAuth><AdminCatalogPage /></RequireAuth>} />
          <Route path="/admin/import" element={<RequireAuth><AdminImportPage /></RequireAuth>} />
          <Route path="/admin/recommended" element={<RequireAuth><AdminRecommendedBuildsPage /></RequireAuth>} />
          <Route path="/admin/maps" element={<RequireAuth><AdminMapsPage /></RequireAuth>} />
          <Route path="/admin/access" element={<RequireAuth><AdminAccessPage /></RequireAuth>} />
          <Route path="/admin/audit" element={<RequireAuth><AdminAuditPage /></RequireAuth>} />
        </Routes>

        <footer className="td2-footer mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-10 text-xs">
          {tx("API", "API")}: <code className="td2-code px-2 py-1">{import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}</code>
        </footer>
      </div>
    </SidebarLayout>
  );
}
