import { API_BASE, parseFastApiDetail } from "../api";

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseFastApiDetail(data));
  }
  return data;
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
  loginWithOtp(mobile, otp) {
    return postJson("/login/patient-otp", { mobile, otp });
  },
};

export const adminAuthService = {
  login(email, password) {
    return postJson("/admin/login", {
      email: email.trim().toLowerCase(),
      password,
    });
  },
};
