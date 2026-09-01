import { apiClient } from "./client";

export const appointmentsApi = {
  getAppointments: () => apiClient.get("/patient/appointments"),
  getOrganizations: () => apiClient.get("/patient/appointments/organizations"),
  getBranches: (orgId) => apiClient.get(`/patient/appointments/organizations/${orgId}/branches`),
  getDepartments: (branchId) => apiClient.get(`/patient/appointments/branches/${branchId}/departments`),
  getDoctors: (deptId) => apiClient.get(`/patient/appointments/departments/${deptId}/doctors`),
  getIndependentDoctors: () => apiClient.get("/patient/appointments/independent-doctors"),
  getTelemedicineDoctors: () => apiClient.get("/patient/appointments/telemedicine-doctors"),
  getDoctorById: (doctorId) => apiClient.get(`/patient/appointments/doctors/by-user/${doctorId}`),
  getAvailableSlots: (doctorId, date) => apiClient.get(`/api/v1/appointments/slots?doctor_id=${doctorId}&date=${date}`),
  lockSlot: (data) => apiClient.post("/api/v1/appointments/slots/lock", data),
  bookAppointment: (data) => apiClient.post("/api/v1/appointments/book", data),
  cancelAppointment: (id) => apiClient.post(`/patient/appointments/${id}/cancel`)
};
