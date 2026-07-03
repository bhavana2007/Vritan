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
  const [email, setEmail] = useState("");
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
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
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
      console.log("LOGIN STARTED - Attempting admin login");
      const loggedInUser = await loginAdmin(normalizedEmail, password);
      console.log("LOGIN RESPONSE:", loggedInUser);
      if (!loggedInUser || loggedInUser.role !== "admin") {
        throw new Error("Admin access required.");
      }
      const from = location.state?.from;
      const target = from && from.startsWith("/admin") ? from : "/admin";
      console.log("LOGIN SUCCESS - Redirecting to:", target);
      setPostLoginTarget(target);
    } catch (error) {
      console.error("LOGIN FAILED:", error);
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
          <div className="med-brand">
            <img src="/logo.png" alt="MediLocker" className="med-logo" />
            <div className="text-left">
              <h1 className="med-title text-3xl">MediLocker</h1>
              <p className="text-sm med-muted">Admin Control Center</p>
            </div>
          </div>
          <p className="mt-4 text-sm med-muted">
            Secure administrator access for doctor verification and platform oversight.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
