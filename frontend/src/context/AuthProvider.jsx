import { useCallback, useMemo, useState } from "react";

import { API_BASE, parseFastApiDetail } from "../api";
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

  const login = useCallback(async (identifier, password) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(parseFastApiDetail(data));
    }

    localStorage.setItem(STORAGE_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(data.user));
    setSession({ token: data.access_token, user: data.user });
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      bootstrapped: true,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
