import { apiClient } from "./client";

export const prescriptionsApi = {
  getPrescriptions: () => apiClient.get("/patient/prescriptions"),
  downloadPrescription: (id) => apiClient.downloadFile(`/patient/prescriptions/${id}/download`),
  generateQR: (payload) => apiClient.post("/prescriptions/verify/generate", payload),
  revokeQR: (payload) => apiClient.post("/prescriptions/verify/revoke", payload),
  verifyQR: (verificationId) => apiClient.get(`/prescriptions/verify/${verificationId}`)
};
