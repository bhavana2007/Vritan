import api from "../services/api";

export const hospitalApi = {
    searchHospitals: async (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.search) queryParams.append('search', params.search);
        if (params.name) queryParams.append('name', params.name);
        if (params.city) queryParams.append('city', params.city);
        if (params.organization_type) queryParams.append('organization_type', params.organization_type);
        if (params.skip) queryParams.append('skip', params.skip.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        
        const queryString = queryParams.toString();
        const endpoint = queryString ? `/v1/hospitals?${queryString}` : '/v1/hospitals';
        
        const response = await api.get(endpoint);
        return response.data;
    }
};
