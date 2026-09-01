import { API_BASE } from "../api";

/**
 * Base API Client with built-in JWT authentication, error handling, and retry logic.
 */
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  getAuthHeaders() {
    // Phase 0: Use consistent key
    const token = localStorage.getItem("medilocker_token");
    const activeProfileId = localStorage.getItem("vritan_active_profile_id");
    if (!token) return {};
    const headers = { Authorization: `Bearer ${token}` };
    if (activeProfileId) {
      headers["X-Patient-Profile-ID"] = activeProfileId;
    }
    return headers;
  }

  getFriendlyErrorMessage(status) {
    switch (status) {
      case 401:
        return "Invalid session or credentials. Please verify your token/OTP.";
      case 403:
        return "You don't have permission to access this resource.";
      case 404:
        return "The requested account or information could not be found.";
      case 409:
        return "Account already exists. Please sign in.";
      case 422:
        return "Invalid request payload. Please verify your inputs.";
      case 500:
        return "An unexpected server error occurred. Please try again.";
      default:
        return "Something went wrong. Please try again shortly.";
    }
  }

  async request(endpoint, options = {}, retries = 1) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Auto-attach JWT if not provided
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    // Auto-set Content-Type for JSON (unless it's FormData)
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      // Parse JSON safely
      let data = null;
      if (response.status !== 204) {
        if (options.responseType === 'blob') {
          data = await response.blob();
        } else {
          try {
            data = await response.json();
          } catch (err) {
            // Ignore parse errors if response is OK but not JSON
          }
        }
      }

      if (!response.ok) {
        // Log technical error to console
        console.error(`API Error ${response.status} at ${endpoint}:`, data);

        if (response.status === 401) {
          // Force logout on 401 Unauthorized
          const storedUser = localStorage.getItem("medilocker_user");
          let role = null;
          if (storedUser) {
            try {
              role = JSON.parse(storedUser).role;
            } catch (e) {}
          }
          
          localStorage.removeItem("medilocker_token");
          localStorage.removeItem("medilocker_user");
          localStorage.removeItem("vritan_active_profile_id");

          let redirectPath = "/login";
          if (role === "admin") redirectPath = "/admin/login";
          else if (role === "doctor") redirectPath = "/login/doctor";
          else if (role === "hospital_admin") redirectPath = "/login/hospital";
          else if (role === "pharmacist") redirectPath = "/login/pharmacy";
          else if (role === "government_authority") redirectPath = "/login/government";
          else if (role === "lab_tech") redirectPath = "/login/lab_tech";

          if (window.location.pathname !== redirectPath && !window.location.pathname.startsWith("/login")) {
            window.location.href = redirectPath;
          }
        }

        
        let detail = "";
        if (typeof data?.detail === "string") {
          detail = data.detail;
        } else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
          detail = data.detail[0].msg;
        } else if (typeof data?.message === "string") {
          detail = data.message;
        }

        const errorMsg = detail || this.getFriendlyErrorMessage(response.status);
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        error.isFriendly = true;
        throw error;
      }

      return data;
    } catch (error) {
      // Handle network errors
      if (!error.status) {
        const hasJwt = !!headers["Authorization"];
        const hasProfileId = !!headers["X-Patient-Profile-ID"];
        
        console.error("[PATIENT_AUTH_AUDIT] API Client request encountered a network error / Failed to fetch:", {
          url: url,
          options: options,
          error_message: error.message,
          error_stack: error.stack,
          jwt_attached: hasJwt,
          profile_id_attached: hasProfileId,
          timestamp: new Date().toISOString()
        });

        if (retries > 0 && this.shouldRetry(error)) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay before retry
          return this.request(endpoint, options, retries - 1);
        }
        const networkError = new Error(error.message || "Unable to connect to the server. Check your internet connection.");
        networkError.isFriendly = true;
        throw networkError;
      }

      if (retries > 0 && this.shouldRetry(error)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.request(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  shouldRetry(error) {
    // Retry on network errors or 5xx server errors
    if (!error.status) return true; // Network error
    if (error.status >= 500 && error.status < 600) return true;
    if (error.status === 429) return true; // Rate limit
    return false;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }

  downloadFile(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET", responseType: "blob" });
  }
}

export const apiClient = new ApiClient(API_BASE);
