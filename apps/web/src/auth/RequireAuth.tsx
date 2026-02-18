import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
