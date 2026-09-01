import { Link, Navigate, useLocation, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";

import { homeRouteForRole } from "../homeRoute";
import { useAuth } from "../hooks/useAuth";
import { doctorAuthService } from "../services/authService";

function normalizeMobileDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function BrandHeader() {
  return (
    <div className="mb-4 text-center animate-fade-in">
      <div className="flex flex-col items-center justify-center">
        <img
          src="/image(236).png"
          alt="Vritan Ecosystem"
          className="w-full max-w-[280px] sm:max-w-[320px] h-auto object-contain"
        />
        <p className="text-xs font-semibold text-slate-500 mt-1">Enterprise Healthcare Platform</p>
      </div>
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
      await doctorAuthService.sendResetOtp(email);
      setResetEmail(email);
      setResetOtp("");
      setStep("otp");
      setMessage("OTP sent. Check the backend console during development.");
    } catch (err) {
      setErrorMessage(err?.data?.detail || err?.message || "Could not send OTP.");
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
    setErrorMessage("");

    try {
      await doctorAuthService.verifyResetOtp(resetEmail, otpDigits);
      setStep("password");
      setMessage("OTP verified. Enter your new password.");
    } catch (err) {
      setErrorMessage(err?.data?.detail || err?.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      await doctorAuthService.resetPassword(resetEmail, resetOtp, newPassword);
      setStep("success");
    } catch (err) {
      setErrorMessage(err?.data?.detail || err?.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 med-card-compact p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <h2 className="text-center text-sm font-bold text-slate-800">
        Reset Doctor Password
      </h2>

      {step === "email" && (
        <form className="mt-4 space-y-3" onSubmit={handleSendResetOtp}>
          <input
            type="email"
            placeholder="Registered doctor email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            disabled={loading}
            className="med-input w-full text-xs"
          />
          <button type="submit" disabled={loading} className="med-button w-full text-xs">
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form className="mt-4 space-y-3" onSubmit={handleVerifyResetOtp}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={resetOtp}
            onChange={(e) => setResetOtp(normalizeMobileDigits(e.target.value))}
            disabled={loading}
            className="med-input w-full text-xs"
          />
          <button type="submit" disabled={loading} className="med-button w-full text-xs">
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      )}

      {step === "password" && (
        <form className="mt-4 space-y-3" onSubmit={handleResetPassword}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            className="med-input w-full text-xs"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="med-input w-full text-xs"
          />
          <button type="submit" disabled={loading} className="med-button w-full text-xs">
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      )}

      {step === "success" && (
        <div className="mt-4 med-alert med-alert-success text-center text-xs">
          Password updated successfully. You can sign in now.
        </div>
      )}

      {message && <p className="mt-3 text-xs text-emerald-700 text-center font-medium">{message}</p>}
      {errorMessage && <p className="mt-3 text-xs text-red-600 text-center font-medium">{errorMessage}</p>}
    </div>
  );
}

function Login() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    login,
    loginPatientWithOtp,
    loginLab,
    isAuthenticated,
    user,
    bootstrapped,
  } = useAuth();

  const initialMode = params.role || searchParams.get("role") || "patient";
  
  if (initialMode === "admin") {
    return <Navigate to="/admin/login" replace state={location.state} />;
  }

  const [mode, setMode] = useState(initialMode);
  
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [identifier, setIdentifier] = useState(""); 
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [postLoginTarget, setPostLoginTarget] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Account-not-found: only set when backend returns 404 (no account exists)
  const [accountNonExistent, setAccountNonExistent] = useState(false);

  // Pending approval: set when backend returns 403 or ProtectedRoute redirects here
  const [pendingApproval, setPendingApproval] = useState(
    () => Boolean(location.state?.pendingApproval)
  );

  const otpInputRef = useRef(null);

  useEffect(() => {
    const routeRole = params.role || searchParams.get("role");
    if (routeRole) {
      setMode(routeRole);
      setAccountNonExistent(false);
      setPendingApproval(false);
    }
  }, [params.role, searchParams]);

  useEffect(() => {
    if (mode === "patient" && !window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      } catch (e) {
        console.warn("reCAPTCHA init warning:", e);
      }
    }

    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // ignore
        }
        window.recaptchaVerifier = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <p className="text-slate-500 font-bold">Initializing Vritan Portal...</p>
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
    const formattedPhone = digits.length === 10 ? `+91${digits}` : `+${digits}`;

    setMessage("");
    setErrorMessage("");
    setSendingOtp(true);
    setAccountNonExistent(false);

    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setOtp("");
      setOtpSent(true);
      setCountdown(60);
      setMessage("OTP sent via Firebase SMS.");
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err) {
      console.error("Firebase OTP Error:", err);
      setErrorMessage(err?.message || "Could not send Firebase OTP.");
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e){}
        window.recaptchaVerifier = null;
      }
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
      const result = await confirmationResult.confirm(otpDigits);
      const idToken = await result.user.getIdToken();
      try {
        const loggedInUser = await loginPatientWithOtp(digits, idToken);
        finishLogin(loggedInUser);
      } catch (authErr) {
        // WhatsApp model: phone non-existence triggers inline seamless registration flow
        if (authErr.needsRegistration || authErr.status === 404) {
          navigate("/register/patient", {
            state: {
              mobile: digits,
              firebaseIdToken: idToken
            }
          });
        } else {
          throw authErr;
        }
      }
    } catch (err) {
      console.error("Patient Login Error:", err);
      setErrorMessage(err?.data?.detail || err?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStakeholderLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage("Please enter your email or Vritan ID and password.");
      return;
    }

    setErrorMessage("");
    setPendingApproval(false);
    setAccountNonExistent(false);
    setLoading(true);

    try {
      const loggedInUser = mode === "lab_tech" 
        ? await loginLab(identifier.trim().toLowerCase(), password)
        : await login(identifier.trim(), password);
      
      finishLogin(loggedInUser);
    } catch (err) {
      console.error("Stakeholder Login Error:", err);

      if (err.status === 403) {
        // Account exists but is not yet approved — show calm amber panel, not a red error.
        setPendingApproval(true);
      } else if (err.status === 404) {
        // Account truly doesn't exist — offer registration link.
        setAccountNonExistent(true);
        setErrorMessage(`No account found. Click below to register as a new ${mode.charAt(0).toUpperCase() + mode.slice(1)}.`);
      } else {
        setErrorMessage(err?.data?.detail || err?.message || "Login authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const patientIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>;
  const doctorIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>;
  const hospitalIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>;
  const pharmacyIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>;
  const govIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg>;
  const labIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>;

  const stakeholderTabs = [
    { id: "patient", label: "Patient (OTP)", icon: patientIcon },
    { id: "doctor", label: "Doctor", icon: doctorIcon },
    { id: "hospital", label: "Hospital", icon: hospitalIcon },
    { id: "pharmacy", label: "Pharmacy", icon: pharmacyIcon },
    { id: "government", label: "Government", icon: govIcon },
    { id: "lab_tech", label: "Laboratory", icon: labIcon },
  ];

  const getIdentifierPlaceholder = () => {
    switch (mode) {
      case "doctor":
        return "Official Email OR Doctor Vritan ID (e.g. VR-DOC-XXXXXX)";
      case "hospital":
        return "Official Email OR Hospital Vritan ID (e.g. VR-HOSP-XXXXXX)";
      case "pharmacy":
        return "Official Email OR Pharmacy Vritan ID (e.g. VR-PHAR-XXXXXX)";
      case "government":
        return "Official Email OR Government Vritan ID (e.g. VR-GOV-XXXXXX)";
      case "lab_tech":
        return "Official Email OR Tech Vritan ID (e.g. VR-LAB-XXXXXX)";
      default:
        return "Official Email or Vritan ID";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-6">
        <BrandHeader />

        {/* Stakeholder Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-left">
            Select Stakeholder Sign In Mode
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {stakeholderTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  navigate(`/login/${tab.id}`);
                  setShowForgotPassword(false);
                  setErrorMessage("");
                  setMessage("");
                  setAccountNonExistent(false);
                  setPendingApproval(false);
                }}
                className={`group py-2 px-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  mode === tab.id
                    ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-200 font-extrabold"
                    : "text-slate-500 hover:text-slate-900 border border-transparent"
                }`}
              >
                <div className={mode === tab.id ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"}>{tab.icon}</div>
                <span className="truncate max-w-[70px] text-[10px] sm:text-[11px]">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Container */}
        {mode === "patient" ? (
          /* Patient OTP Form */
          <form className="space-y-4 text-left" onSubmit={handlePatientLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (Firebase OTP)</label>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="10-digit Mobile Number"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setOtpSent(false);
                  setOtp("");
                  setMessage("");
                  setErrorMessage("");
                }}
                disabled={loading || sendingOtp}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              disabled={loading || sendingOtp}
              onClick={handleSendOtp}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {sendingOtp ? "Sending OTP..." : "Send OTP via SMS"}
            </button>

            {otpSent && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">6-Digit Verification Code</label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(normalizeMobileDigits(e.target.value))}
                    disabled={loading}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold tracking-widest text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  {countdown > 0 ? (
                    <span className="text-slate-500">Resend OTP in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || sendingOtp}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  {loading ? "Verifying..." : "Verify OTP & Sign In"}
                </button>
              </div>
            )}
            <div id="recaptcha-container"></div>
          </form>
        ) : (
          /* Password Form for Doctor, Hospital, Pharmacy, Government */
          <form className="space-y-4 text-left" onSubmit={handleStakeholderLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {mode === "doctor" ? "Doctor Official Email or Vritan ID" :
                 mode === "hospital" ? "Hospital Official Email or Vritan ID" :
                 mode === "pharmacy" ? "Pharmacy Official Email or Vritan ID" :
                 mode === "government" ? "Government Official Email or Vritan ID" :
                 "Official Identifier"}
              </label>
              <input
                type="text"
                placeholder={getIdentifierPlaceholder()}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="Account Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
            >
              {loading ? "Authenticating..." : `Sign In to ${mode.toUpperCase()} Workspace`}
            </button>

            {mode === "doctor" && (
              <button
                type="button"
                onClick={() => setShowForgotPassword((current) => !current)}
                className="w-full text-center text-xs font-bold text-emerald-700 hover:underline pt-1"
              >
                Forgot Doctor Password?
              </button>
            )}
          </form>
        )}

        {mode === "doctor" && showForgotPassword && (
          <ForgotPasswordPanel initialEmail={identifier} />
        )}

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl text-center">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl text-left space-y-1">
            <div className="flex items-center gap-1.5 text-red-800 font-extrabold uppercase text-[10px] tracking-wider">
              <span>⚠️</span> Authentication Error
            </div>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Pending Admin Approval — shown on 403 from login, or when ProtectedRoute redirects here */}
        {pendingApproval && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-lg">⏳</span>
              <p className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                Application Under Review
              </p>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your registration is currently under review by the Vritan administrative team.
              Login is not permitted until your application is approved.
              Once approved, you will receive an email with your Vritan ID and a link to set your password.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <Link
                to="/application-status"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
              >
                📊 Check Application Status →
              </Link>
              <Link
                to="/"
                className="inline-block text-xs font-bold text-amber-600 hover:underline"
              >
                ← Return to Home
              </Link>
            </div>
          </div>
        )}


        {accountNonExistent && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Link
              to={`/register/${mode}`}
              className="w-full text-center block text-xs font-bold text-emerald-700 hover:underline"
            >
              Register as a new {mode.charAt(0).toUpperCase() + mode.slice(1)} &rarr;
            </Link>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-500">
          <Link to="/" className="text-slate-600 font-bold hover:text-emerald-700 hover:underline">
            ← Back to Home
          </Link>
          <span>
            New to Vritan?{" "}
            <Link to="/join" className="text-emerald-700 font-bold hover:underline">
              Join Vritan
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Login;
