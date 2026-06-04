import { Navigate, useLocation } from "react-router-dom";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ children, allowedRoles }) {
  const { bootstrapped, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="med-auth-page">
        <p className="text-lg med-muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
