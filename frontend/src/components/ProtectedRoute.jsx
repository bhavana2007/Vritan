import { Navigate, useLocation } from "react-router-dom";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ children, allowedRoles, loginPath = "/" }) {
  const { bootstrapped, isAuthenticated, user, token } = useAuth();
  const location = useLocation();

  console.log("PROTECTED ROUTE - bootstrapped:", bootstrapped, "isAuthenticated:", isAuthenticated, "user:", user, "token:", token ? "exists" : "missing");
  console.log("PROTECTED ROUTE - allowedRoles:", allowedRoles, "user.role:", user?.role);

  if (!bootstrapped) {
    return (
      <div className="med-auth-page">
        <p className="text-lg med-muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("PROTECTED ROUTE - REDIRECTING to login because not authenticated");
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log("PROTECTED ROUTE - REDIRECTING because role mismatch. user.role:", user.role, "allowedRoles:", allowedRoles);
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  console.log("PROTECTED ROUTE - ACCESS GRANTED, rendering children");
  return children;
}

export default ProtectedRoute;
