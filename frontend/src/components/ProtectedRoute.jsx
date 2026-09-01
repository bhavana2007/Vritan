import { Navigate, useLocation } from "react-router-dom";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

// Roles that require explicit admin approval before accessing any protected resource
const STAKEHOLDER_ROLES = [
  "doctor",
  "hospital_admin",
  "pharmacist",
  "government_authority",
  "lab_tech",
];

function ProtectedRoute({ children, allowedRoles, loginPath }) {
  const { bootstrapped, isAuthenticated, user } = useAuth();
  const location = useLocation();

  const getLoginPath = () => {
    if (loginPath) return loginPath;
    if (!allowedRoles) return "/login";
    if (allowedRoles.includes("admin")) return "/admin/login";
    if (allowedRoles.includes("doctor")) return "/login/doctor";
    if (allowedRoles.includes("hospital_admin")) return "/login/hospital";
    if (allowedRoles.includes("pharmacist")) return "/login/pharmacy";
    if (allowedRoles.includes("government_authority")) return "/login/government";
    if (allowedRoles.includes("lab_tech")) return "/login/lab_tech";
    if (allowedRoles.includes("patient")) return "/login/patient";
    return "/login";
  };

  const activeLoginPath = getLoginPath();

  if (!bootstrapped) {
    return (
      <div className="med-auth-page">
        <p className="text-lg med-muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={activeLoginPath} replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  // Verification gate: stakeholder accounts must be APPROVED before accessing any portal.
  // Only the exact value "APPROVED" is accepted (case-insensitive). VERIFIED or any other
  // status is treated as not yet approved and the user is redirected to their login page.
  // This is defense-in-depth — the backend already blocks login for non-APPROVED users,
  // but an admin suspension after an active session would otherwise leave a valid JWT.
  if (STAKEHOLDER_ROLES.includes(user.role)) {
    const status = (user.verification_status || "").toUpperCase();
    if (status !== "APPROVED") {
      return (
        <Navigate
          to={activeLoginPath}
          replace
          state={{ from: location.pathname, pendingApproval: true }}
        />
      );
    }
  }

  return children;
}

export default ProtectedRoute;
