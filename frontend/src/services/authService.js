import { apiClient } from "../api/client";

async function postJson(path, body) {
  return apiClient.post(path, body);
}

export const doctorAuthService = {
  loginWithPassword(identifier, password) {
    return postJson("/login", {
      identifier: identifier.trim(),
      password,
    });
  },
  sendResetOtp(email) {
    return postJson("/doctor/send-reset-otp", { email });
  },
  verifyResetOtp(email, otp) {
    return postJson("/doctor/verify-reset-otp", { email, otp });
  },
  resetPassword(email, otp, newPassword) {
    return postJson("/doctor/reset-password", {
      email,
      otp,
      new_password: newPassword,
    });
  },
};

export const patientAuthService = {
  async loginWithOtp(mobile, firebase_id_token) {
    try {
      return await postJson("/login/patient-firebase", { mobile, firebase_id_token });
    } catch (err) {
      if (err.status === 404 && err.data?.detail === "NO_ACCOUNT") {
        err.needsRegistration = true;
      }
      throw err;
    }
  },
};

export const adminAuthService = {
  login(identifier, password) {
    return postJson("/admin/login", {
      identifier: identifier.trim().toLowerCase(),
      password,
    });
  },
};

export const labAuthService = {
  login(email, password) {
    return postJson("/lab/login", {
      email: email.trim().toLowerCase(),
      password,
    });
  },
};
