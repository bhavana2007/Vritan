import { Navigate, useLocation } from "react-router-dom";
import { useState } from "react";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function AdminLogin() {
  const { bootstrapped, isAuthenticated, loginAdmin, user } = useAuth();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [postLoginTarget, setPostLoginTarget] = useState(null);

  if (!bootstrapped) {
    return (
      <div className="med-auth-page">
        <p className="med-muted">Loading...</p>
      </div>
    );
  }

  if (postLoginTarget) {
    return <Navigate to={postLoginTarget} replace />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    let cleanIdentifier = identifier.trim().toLowerCase();
    
    // Strip markdown if accidentally pasted (e.g., [email](mailto:email))
    const mdMatch = cleanIdentifier.match(/\[(.*?)\]\(.*?\)/);
    if (mdMatch) {
      cleanIdentifier = mdMatch[1];
    }
    const normalizedIdentifier = cleanIdentifier.replace("mailto:", "");

    if (!normalizedIdentifier || !isValidEmail(normalizedIdentifier)) {
      setErrorMessage("Enter a valid admin email.");
      return;
    }
    if (!password) {
      setErrorMessage("Enter your admin password.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const loggedInUser = await loginAdmin(normalizedIdentifier, password);
      if (!loggedInUser || loggedInUser.role !== "admin") {
        throw new Error("Admin access required.");
      }
      const from = location.state?.from;
      const target = from && from.startsWith("/admin") ? from : "/admin";
      setPostLoginTarget(target);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Invalid admin credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="med-auth-page">
      <div className="w-full max-w-md med-card p-5 sm:p-8">
        <div className="mb-6 text-center">
          <div className="flex flex-col items-center justify-center">
            <img
              src="/image(236).png"
              alt="Vritan"
              className="w-full max-w-[280px] sm:max-w-[350px] h-auto object-contain"
            />
          </div>
          <h1 className="mt-4 med-title text-xl font-semibold">Admin Control Center</h1>
          <p className="mt-2 text-sm med-muted">
            Secure administrator access for doctor verification and platform oversight.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Admin email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            disabled={loading}
            className="med-input"
          />

          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            className="med-input"
          />

          <button type="submit" disabled={loading} className="med-button w-full">
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {errorMessage ? (
          <p className="mt-4 med-alert med-alert-danger text-center">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default AdminLogin;
