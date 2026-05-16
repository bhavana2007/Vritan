import { Navigate, useLocation } from "react-router-dom";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

/**
 * MVP route guard: requires a JWT in localStorage (set at login).
 * If `allowedRoles` is set, only those roles may view the route.
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { bootstrapped, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p className="text-lg">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate to={homeRouteForRole(user.role)} replace />
    );
  }

  return children;
}

export default ProtectedRoute;
