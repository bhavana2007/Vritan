import { apiClient } from "./client";

export const patientApi = {
  getProfile: () => apiClient.get("/patient/me"),
  updateProfile: (data) => apiClient.put("/profile/patient", data),
  getDashboardSummary: () => apiClient.get("/patient/dashboard-summary"),
  getAccessRequests: () => apiClient.get("/patient/access-requests"),
  respondAccessRequest: (id, decision) => apiClient.post(`/patient/access-requests/${id}/${decision}`)
};
