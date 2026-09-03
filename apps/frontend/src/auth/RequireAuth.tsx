import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "../components/ui/States";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState />;
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
