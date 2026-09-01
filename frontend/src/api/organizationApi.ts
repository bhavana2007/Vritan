import { apiClient } from "./client";

export const organizationApi = {
    getDashboardMetrics: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}/metrics`);
    },
    getBranches: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}/branches`);
    },
    createBranch: async (orgIdOrVritanId: string, payload: any) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/branches`, payload);
    },
    updateBranch: async (orgIdOrVritanId: string, branchId: number, payload: any) => {
        return apiClient.put(`/api/v1/organizations/${orgIdOrVritanId}/branches/${branchId}`, payload);
    },
    verifyBranchCreationOtp: async (orgIdOrVritanId: string, branchId: number, payload: any) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/branches/${branchId}/verify-creation-otp`, payload);
    },
    uploadBranchDocument: async (orgIdOrVritanId: string, branchId: number, formData: FormData) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/branches/${branchId}/documents`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
    },
    sendBranchVerificationEmail: async (orgIdOrVritanId: string, branchId: number) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/branches/${branchId}/send-verification-email`, {});
    },
    submitBranchForReview: async (orgIdOrVritanId: string, branchId: number) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/branches/${branchId}/submit`, {});
    },
    getDepartments: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}/departments`);
    },
    createDepartment: async (orgIdOrVritanId: string, payload: any) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/departments`, payload);
    },
    updateDepartment: async (orgIdOrVritanId: string, deptId: number, payload: any) => {
        return apiClient.put(`/api/v1/organizations/${orgIdOrVritanId}/departments/${deptId}`, payload);
    },
    getDoctors: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}/doctors`);
    },
    inviteMember: async (orgIdOrVritanId: string, payload: any) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/invite-member`, payload);
    },
    getInvitations: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}/invitations`);
    },
    resendInvitation: async (orgIdOrVritanId: string, inviteId: number) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/invitations/${inviteId}/resend`, {});
    },
    cancelInvitation: async (orgIdOrVritanId: string, inviteId: number) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/invitations/${inviteId}/cancel`, {});
    },
    removeDoctor: async (orgIdOrVritanId: string, doctorId: number) => {
        return apiClient.delete(`/api/v1/organizations/${orgIdOrVritanId}/doctors/${doctorId}`);
    },
    transferDoctor: async (orgIdOrVritanId: string, doctorId: number, payload: any) => {
        return apiClient.put(`/api/v1/organizations/${orgIdOrVritanId}/doctors/${doctorId}/transfer`, payload);
    },
    confirmDoctorTransfer: async (orgIdOrVritanId: string, payload: any) => {
        return apiClient.post(`/api/v1/organizations/${orgIdOrVritanId}/doctors/transfer/confirm`, payload);
    },
    getOrganizationProfile: async (orgIdOrVritanId: string) => {
        return apiClient.get(`/api/v1/organizations/${orgIdOrVritanId}`);
    },
    updateOrganizationProfile: async (orgIdOrVritanId: string, payload: any) => {
        return apiClient.put(`/api/v1/organizations/${orgIdOrVritanId}`, payload);
    },
    getAppointments: async (orgIdOrVritanId: string, params?: Record<string, any>) => {
        let url = `/api/v1/organizations/${orgIdOrVritanId}/appointments`;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    searchParams.append(key, String(value));
                }
            });
            const queryString = searchParams.toString();
            if (queryString) {
                url += `?${queryString}`;
            }
        }
        return apiClient.get(url);
    }
};
