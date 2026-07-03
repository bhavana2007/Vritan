import { useCallback, useEffect, useMemo, useState } from "react";

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
    console.log("AUTH PROVIDER - Reading from localStorage - token:", storedToken ? "exists" : "missing", "user:", storedUser ? "exists" : "missing");
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      console.log("AUTH PROVIDER - Parsed user:", parsedUser);
      return {
        token: storedToken,
        user: parsedUser,
      };
    }
  } catch (error) {
    console.error("AUTH PROVIDER - Error reading stored session:", error);
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }
  console.log("AUTH PROVIDER - No stored session found");
  return { token: null, user: null };
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => {
    const { token, user } = readStoredSession();
    return {
      bootstrapped: false, // Will be set to true after initial session check
      token,
      user,
      isAuthenticated: Boolean(token && user),
    };
  });

  // Effect to bootstrap the auth state
  // This runs once on mount to set bootstrapped to true
  // and can re-run if token or user change to re-evaluate isAuthenticated.
  // This ensures that ProtectedRoute doesn't redirect before the initial
  // session check from localStorage is complete.
  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      bootstrapped: true,
    }));
  }, []); // Run only once on mount

  useEffect(() => {
    setState((prevState) => ({
      ...prevState,
      isAuthenticated: Boolean(prevState.token && prevState.user),
    }));
  }, [state.token, state.user]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setState({ bootstrapped: true, token: null, user: null, isAuthenticated: false });
  }, []);

  const saveSession = useCallback((data) => {
    console.log("AUTH PROVIDER - Saving session - access_token:", data.access_token ? "exists" : "missing", "user:", data.user);
    localStorage.setItem(STORAGE_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    setState((prevState) => ({
      ...prevState,
      token: data.access_token,
      user: data.user,
      isAuthenticated: Boolean(data.access_token && data.user),
    }));
    console.log("AUTH PROVIDER - Session saved, verifying localStorage:", localStorage.getItem(STORAGE_TOKEN) ? "token exists" : "token missing", localStorage.getItem(STORAGE_USER) ? "user exists" : "user missing");
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
      ...state,
      login,
      loginAdmin,
      loginPatientWithOtp,
      logout,
    }),
    [state, login, loginAdmin, loginPatientWithOtp, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
