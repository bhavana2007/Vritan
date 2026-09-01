import { API_BASE, parseFastApiDetail } from "../../../api";

export const adminService = {
  async getPendingOrganizations(token) {
    const res = await fetch(`${API_BASE}/admin/organizations/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to load pending organizations");
    return data;
  },

  async performOrgAction(token, orgType, orgId, action, reason = "") {
    const res = await fetch(`${API_BASE}/admin/organizations/${orgType}/${orgId}/action`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to perform action");
    return data;
  },

  async getAuditLogs(token) {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to load audit logs");
    return data;
  },

  async getDoctors(token, status = "pending") {
    const res = await fetch(`${API_BASE}/admin/doctors?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to load doctors");
    return data;
  },

  async updateDoctorStatus(token, doctorId, action) {
    const res = await fetch(`${API_BASE}/admin/doctors/${doctorId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to update doctor status");
    return data;
  },

  async getLaboratories(token, status = "pending") {
    const res = await fetch(`${API_BASE}/admin/laboratories?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to load laboratories");
    return data;
  },

  async updateLaboratoryStatus(token, labId, action) {
    const res = await fetch(`${API_BASE}/admin/laboratories/${labId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseFastApiDetail(data) || "Failed to update laboratory status");
    return data;
  }
};
