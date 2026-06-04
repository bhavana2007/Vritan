import { useCallback, useMemo, useState } from "react";

import {
  adminAuthService,
  doctorAuthService,
  patientAuthService,
} from "../services/authService";
import { AuthContext } from "./authContext";

const STORAGE_TOKEN = "medilocker_token";
const STORAGE_USER = "medilocker_user";

function readStoredSession() {
  try {
    const storedToken = localStorage.getItem(STORAGE_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_USER);
    if (storedToken && storedUser) {
      return {
        token: storedToken,
        user: JSON.parse(storedUser),
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }) {
  const [{ token, user }, setSession] = useState(readStoredSession);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setSession({ token: null, user: null });
  }, []);

  const saveSession = useCallback((data) => {
    localStorage.setItem(STORAGE_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    setSession({ token: data.access_token, user: data.user });
    return data.user;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await doctorAuthService.loginWithPassword(identifier, password);
    return saveSession(data);
  }, [saveSession]);

  const loginPatientWithOtp = useCallback(async (mobile, otp) => {
    const data = await patientAuthService.loginWithOtp(mobile, otp);
    return saveSession(data);
  }, [saveSession]);

  const loginAdmin = useCallback(async (email, password) => {
    const data = await adminAuthService.login(email, password);
    return saveSession(data);
  }, [saveSession]);

  const value = useMemo(
    () => ({
      bootstrapped: true,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      loginAdmin,
      loginPatientWithOtp,
      logout,
    }),
    [token, user, login, loginAdmin, loginPatientWithOtp, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
