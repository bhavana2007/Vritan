import { apiClient } from "./client";

export const recordsApi = {
  getRecords: (search) => apiClient.get(search ? `/patient/records?search=${encodeURIComponent(search)}` : "/patient/records"),
  uploadRecord: (formData) => apiClient.post("/records/upload", formData),
  deleteRecord: (id) => apiClient.delete(`/records/${id}`),
  getRecordPreview: (fileUrl) => apiClient.downloadFile(fileUrl)
};
