import { Link, Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

import { API_BASE, parseFastApiDetail } from "../api";
import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";
import { doctorAuthService } from "../services/authService";

function normalizeMobileDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateDoctorPassword(password) {
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return "Password needs 8+ characters with uppercase, lowercase, number, and special character.";
  }
  return "";
}

function BrandHeader({ subtitle }) {
  return (
    <div className="mb-6 text-center">
      <div className="med-brand">
        <img src="/logo.png" alt="MediLocker" className="med-logo" />
        <div className="text-left">
          <h1 className="med-title text-3xl">MediLocker</h1>
          <p className="text-sm med-muted">Your Secure Medical Vault</p>
        </div>
      </div>
      <p className="mt-4 text-sm med-muted">{subtitle}</p>
    </div>
  );
}

function ForgotPasswordPanel({ initialEmail = "" }) {
  const [step, setStep] = useState("email");
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendRequest(path, body) {
    if (path === "/doctor/send-reset-otp") {
      return doctorAuthService.sendResetOtp(body.email);
    }
    if (path === "/doctor/verify-reset-otp") {
      return doctorAuthService.verifyResetOtp(body.email, body.otp);
    }
    if (path === "/doctor/reset-password") {
      return doctorAuthService.resetPassword(
        body.email,
        body.otp,
        body.new_password,
      );
    }
    throw new Error("Unsupported doctor auth request.");
  }

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setErrorMessage("Enter your registered doctor email.");
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      await sendRequest("/doctor/send-reset-otp", { email });
      setResetEmail(email);
      setResetOtp("");
      setStep("otp");
      setMessage("OTP sent. Check the backend console during development.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    const otpDigits = normalizeMobileDigits(resetOtp);
    if (otpDigits.length !== 6) {
      setErrorMessage("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      await sendRequest("/doctor/verify-reset-otp", {
        email: resetEmail.trim().toLowerCase(),
        otp: otpDigits,
      });
      setResetOtp(otpDigits);
      setStep("password");
      setMessage("OTP verified. Set a new password.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not verify OTP.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const passwordError = validateDoctorPassword(newPassword);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      await sendRequest("/doctor/reset-password", {
        email: resetEmail.trim().toLowerCase(),
        otp: normalizeMobileDigits(resetOtp),
        new_password: newPassword,
      });
      setStep("success");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully. You can sign in now.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not reset password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 med-card-compact p-4">
      <h2 className="text-center text-lg font-semibold med-title">
        Reset doctor password
      </h2>

      {step === "email" ? (
        <form className="mt-4 space-y-3" onSubmit={handleSendResetOtp}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Registered doctor email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={loading}
            className="med-input"
          />
          <button type="submit" disabled={loading} className="med-button w-full">
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className="mt-4 space-y-3" onSubmit={handleVerifyResetOtp}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={resetOtp}
            onChange={(e) => setResetOtp(normalizeMobileDigits(e.target.value))}
            disabled={loading}
            className="med-input"
          />
          <button type="submit" disabled={loading} className="med-button w-full">
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="mt-4 space-y-3" onSubmit={handleResetPassword}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            className="med-input"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="med-input"
          />
          <button type="submit" disabled={loading} className="med-button w-full">
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      ) : null}

      {step === "success" ? (
        <div className="mt-4 med-alert med-alert-success text-center">
          Reset success.
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 med-alert med-alert-info text-center">{message}</p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 med-alert med-alert-danger text-center">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function Login() {
  const {
    login,
    loginPatientWithOtp,
    isAuthenticated,
    user,
    bootstrapped,
  } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState("patient");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [postLoginTarget, setPostLoginTarget] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const greetedRegistration = useRef(false);

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
      <div className="med-auth-page">
        <p className="med-muted">Loading...</p>
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

  const finishLogin = (loggedInUser) => {
    if (registrationFlash) {
      sessionStorage.removeItem("medilocker_registration_flash");
    }

    const from = location.state?.from;
    const home = homeRouteForRole(loggedInUser.role);
    const target = from && from !== "/" ? from : home;
    setPostLoginTarget(target);
  };

  const validateMobile = () => {
    const digits = normalizeMobileDigits(mobile);
    if (digits.length < 10 || digits.length > 15) {
      setErrorMessage("Please enter a valid mobile number with 10 to 15 digits.");
      return "";
    }
    return digits;
  };

  const handleSendOtp = async () => {
    const digits = validateMobile();
    if (!digits) return;

    setMessage("");
    setErrorMessage("");
    setSendingOtp(true);

    try {
      const response = await fetch(`${API_BASE}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: digits, purpose: "login" }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setOtp("");
      setOtpSent(true);
      setMessage("OTP sent. Check the backend console during development.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not send OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handlePatientLogin = async (e) => {
    e.preventDefault();

    const digits = validateMobile();
    const otpDigits = normalizeMobileDigits(otp);
    if (!digits) return;
    if (otpDigits.length !== 6) {
      setErrorMessage("Please enter the 6-digit OTP.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const loggedInUser = await loginPatientWithOtp(digits, otpDigits);
      finishLogin(loggedInUser);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Login failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      finishLogin(loggedInUser);
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
    <div className="med-auth-page">
      <div className="w-full max-w-md med-card p-5 sm:p-8">
        <BrandHeader subtitle="Patients use secure mobile OTP. Doctors use verified password access." />

        <div className="mb-5 med-segment">
          <button
            type="button"
            className={`med-segment-button ${
              mode === "patient" ? "med-segment-button-active" : ""
            }`}
            disabled={loading || sendingOtp}
            onClick={() => {
              setMode("patient");
              setShowForgotPassword(false);
              setErrorMessage("");
              setMessage("");
            }}
          >
            Patient
          </button>
          <button
            type="button"
            className={`med-segment-button ${
              mode === "doctor" ? "med-segment-button-active" : ""
            }`}
            disabled={loading || sendingOtp}
            onClick={() => {
              setMode("doctor");
              setErrorMessage("");
              setMessage("");
            }}
          >
            Doctor
          </button>
        </div>

        {showWelcomeBanner ? (
          <p className="mb-4 med-alert med-alert-success text-center">
            Registration successful. You can log in now.
          </p>
        ) : null}

        {mode === "patient" ? (
          <form className="space-y-4" onSubmit={handlePatientLogin}>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Mobile number"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setOtpSent(false);
                setOtp("");
                setMessage("");
              }}
              disabled={loading || sendingOtp}
              className="med-input"
            />

            <button
              type="button"
              disabled={loading || sendingOtp}
              onClick={handleSendOtp}
              className="med-button w-full"
            >
              {sendingOtp ? "Sending..." : "Send OTP"}
            </button>

            {otpSent ? (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(normalizeMobileDigits(e.target.value))}
                  disabled={loading}
                  className="med-input"
                />

                <button type="submit" disabled={loading} className="med-button w-full">
                  {loading ? "Verifying..." : "Verify OTP and Login"}
                </button>
              </>
            ) : null}
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleDoctorLogin}>
            <input
              type="email"
              autoComplete="email"
              placeholder="Professional email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="med-input"
            />

            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="med-input"
            />

            <button type="submit" disabled={loading} className="med-button w-full">
              {loading ? "Signing in..." : "Login"}
            </button>

            <button
              type="button"
              onClick={() => setShowForgotPassword((current) => !current)}
              className="w-full text-center text-sm med-link"
            >
              Forgot Password?
            </button>
          </form>
        )}

        {mode === "doctor" && showForgotPassword ? (
          <ForgotPasswordPanel initialEmail={email} />
        ) : null}

        {message ? (
          <p className="mt-4 med-alert med-alert-info text-center">{message}</p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 med-alert med-alert-danger text-center">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-5 text-center text-sm med-muted">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="med-link">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
