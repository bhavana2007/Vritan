export function homeRouteForRole(role) {
  if (role === "doctor") return "/doctor";
  if (role === "hospital_admin") return "/org-admin/dashboard";
  if (role === "pharmacist") return "/pharmacy";
  if (role === "government_authority") return "/government";
  if (role === "admin") return "/admin/verification";
  if (role === "lab_tech") return "/lab/dashboard";
  return "/dashboard";
}
