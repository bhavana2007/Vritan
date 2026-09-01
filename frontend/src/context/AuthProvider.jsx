import { useCallback, useMemo, useState } from "react";

import {
  adminAuthService,
  doctorAuthService,
  patientAuthService,
  labAuthService,
} from "../services/authService";
import { AuthContext } from "./authContext";

const STORAGE_TOKEN = "medilocker_token";
const STORAGE_USER = "medilocker_user";

function readStoredSession() {
  try {
    const storedToken = localStorage.getItem(STORAGE_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_USER);
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      return {
        token: storedToken,
        user: parsedUser,
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const { token, user } = readStoredSession();
    return {
      bootstrapped: true,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      profiles: user?.profiles || [],
      activeProfileId: localStorage.getItem("vritan_active_profile_id") || (user?.profiles?.[0]?.id || null)
    };
  });

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem("vritan_active_profile_id");
    setState({ bootstrapped: true, token: null, user: null, isAuthenticated: false, profiles: [], activeProfileId: null });
  }, []);

  const switchProfile = useCallback((profileId) => {
    localStorage.setItem("vritan_active_profile_id", profileId);
    setState((prevState) => ({
      ...prevState,
      activeProfileId: String(profileId)
    }));
  }, []);

  const saveSession = useCallback((data) => {
    localStorage.setItem(STORAGE_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    const defaultProfileId = data.user?.profiles?.[0]?.id || null;
    if (defaultProfileId) {
      localStorage.setItem("vritan_active_profile_id", defaultProfileId);
    }
    setState((prevState) => ({
      ...prevState,
      token: data.access_token,
      user: data.user,
      profiles: data.user?.profiles || [],
      activeProfileId: defaultProfileId ? String(defaultProfileId) : null,
      isAuthenticated: Boolean(data.access_token && data.user),
    }));
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

  const loginLab = useCallback(async (email, password) => {
    const data = await labAuthService.login(email, password);
    return saveSession(data);
  }, [saveSession]);

  const loginAdmin = useCallback(async (email, password) => {
    const data = await adminAuthService.login(email, password);
    return saveSession(data);
  }, [saveSession]);

  const activeProfile = useMemo(() => {
    if (!state.user || !state.profiles.length) return null;
    return state.profiles.find((p) => String(p.id) === String(state.activeProfileId)) || state.profiles[0];
  }, [state.user, state.profiles, state.activeProfileId]);

  const value = useMemo(
    () => ({
      ...state,
      activeProfile,
      login,
      loginAdmin,
      loginPatientWithOtp,
      loginLab,
      logout,
      switchProfile,
    }),
    [state, activeProfile, login, loginAdmin, loginPatientWithOtp, loginLab, logout, switchProfile],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
