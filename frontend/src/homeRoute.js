/** Default home route for an authenticated MediLocker role. */
export function homeRouteForRole(role) {
  if (role === "doctor") return "/doctor";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
