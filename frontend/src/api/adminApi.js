import { apiClient } from "./client";

export const adminApi = {
    getBranchApprovals: async () => {
        return apiClient.get('/api/v1/admin/branch-approvals');
    },
    branchAction: async (branchId, payload) => {
        return apiClient.post(`/api/v1/admin/branch-approvals/${branchId}/action`, payload);
    }
};
