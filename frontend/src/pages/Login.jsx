import { Link, useLocation, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";

function Login() {
  const { login, isAuthenticated, user, bootstrapped } = useAuth();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [postLoginTarget, setPostLoginTarget] = useState(null);
  const greetedRegistration = useRef(false);

  /** One-time UX after Register — avoids staying on stale navigation state forever. */
  useEffect(() => {
    if (location.state?.registrationSuccess && !greetedRegistration.current) {
      greetedRegistration.current = true;
      sessionStorage.setItem("medilocker_registration_flash", "1");
    }
  }, [location.state]);

  const registrationFlash =
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem("medilocker_registration_flash") === "1";

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p>Loading…</p>
      </div>
    );
  }

  if (postLoginTarget) {
    return <Navigate to={postLoginTarget} replace />;
  }

  if (isAuthenticated && user) {
    const home = homeRouteForRole(user.role);
    return <Navigate to={home} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedIdent = identifier.trim();

    if (!trimmedIdent || !password) {
      setErrorMessage("Please fill all fields.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const loggedInUser = await login(trimmedIdent, password);
      if (registrationFlash) {
        sessionStorage.removeItem("medilocker_registration_flash");
      }

      const from = location.state?.from;
      const home = homeRouteForRole(loggedInUser.role);
      const target = from && from !== "/" ? from : home;

      setPostLoginTarget(target);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Login failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const showWelcomeBanner =
    location.state?.registrationSuccess || registrationFlash;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          MediLocker
        </h1>

        <p className="text-gray-400 text-sm text-center mb-6">
          Patients sign in with <strong className="text-gray-300">mobile</strong>{" "}
          and password. Doctors use their{" "}
          <strong className="text-gray-300">professional email</strong>. Your role
          is determined by your account.
        </p>

        {showWelcomeBanner ? (
          <p className="mb-4 rounded-lg bg-teal-900/40 border border-teal-700/50 px-3 py-2 text-center text-sm text-teal-200">
            Registration successful. You can log in now.
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-id" className="sr-only">
            Mobile number or email
          </label>
          <input
            id="login-id"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="Mobile number or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
            className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none disabled:opacity-60"
          />

          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white p-3 rounded-lg"
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        {errorMessage ? (
          <p className="text-red-400 text-center mt-4 text-sm">
            {errorMessage}
          </p>
        ) : null}

        <p className="text-gray-300 text-sm text-center mt-4">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-blue-400">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
