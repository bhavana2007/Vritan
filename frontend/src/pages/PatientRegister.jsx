import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";
import { apiClient } from "../api/client";

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function ProgressBar({ current, steps }) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-md mx-auto mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold border-2 transition-all ${
                  done
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : active
                    ? "bg-white border-emerald-600 text-emerald-700 shadow-md"
                    : "bg-slate-100 border-slate-300 text-slate-400"
                }`}
              >
                {done ? "✓" : stepNum}
              </div>
              <span
                className={`mt-1 text-[10px] font-bold whitespace-nowrap ${
                  active ? "text-emerald-700" : done ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-1 mt-[-14px] ${
                  done ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PatientRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const STEPS = ["Identity", "Region", "Consent"];

  // Pre-filled mobile/firebase details from auto-detect login page state
  const presetMobile = location.state?.mobile || "";
  const presetToken = location.state?.firebaseIdToken || "";

  /* Step 1 – Identity */
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [mobile, setMobile] = useState(presetMobile);
  const [otpSent, setOtpSent] = useState(!!presetToken);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(!!presetToken);
  const [firebaseIdToken, setFirebaseIdToken] = useState(presetToken);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [bloodGroup, setBloodGroup] = useState("");

  /* Step 2 – Region */
  const [pinCode, setPinCode] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [postOffices, setPostOffices] = useState([]);
  const [selectedPO, setSelectedPO] = useState(0);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [country] = useState("India");
  const [locState, setLocState] = useState("");
  const [district, setDistrict] = useState("");
  const [mandal, setMandal] = useState("");
  const [city, setCity] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [urbanRural, setUrbanRural] = useState("Urban");

  /* Step 3 – Consent */
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentStorage, setConsentStorage] = useState(false);
  const [consentAnalytics, setConsentAnalytics] = useState(false);
  const [consentResearch, setConsentResearch] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  /* Shared state */
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const otpRef = useRef(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!window.recaptchaVerifier && !presetToken) {
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      } catch (e) {
        console.warn("reCAPTCHA init:", e);
      }
    }
    return () => {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) {}
        window.recaptchaVerifier = null;
      }
    };
  }, [presetToken]);

  const lookupPin = useCallback(async (pin) => {
    if (pin.length !== 6) return;
    setPinLoading(true);
    setPinError("");
    setPostOffices([]);
    setLocationConfirmed(false);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (!data || !data[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) {
        setPinError("Invalid PIN code or no data found. Please check and re-enter.");
        return;
      }
      const offices = data[0].PostOffice;
      setPostOffices(offices);
      setSelectedPO(0);
      applyPO(offices[0]);
    } catch {
      setPinError("Could not lookup PIN code. Please check your internet connection.");
    } finally {
      setPinLoading(false);
    }
  }, []);

  function applyPO(po) {
    setLocState(po.State || "");
    setDistrict(po.District || "");
    const block = po.Block && po.Block !== "NA" ? po.Block : po.Division || "";
    setMandal(block);
    setCity(po.Name || "");
  }

  const handleSendOtp = async () => {
    const d = digits(mobile);
    if (d.length < 10 || d.length > 15) {
      setErrorMessage("Enter a valid 10-15 digit mobile number.");
      return;
    }
    const phone = d.length === 10 ? `+91${d}` : `+${d}`;
    setErrorMessage("");
    setSending(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const confirmation = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setOtpCode("");
      setCountdown(60);
      setTimeout(() => otpRef.current?.focus(), 120);
    } catch (err) {
      console.error("Firebase OTP error:", err);
      setErrorMessage(err?.message || "Could not send OTP. Try again.");
      try { window.recaptchaVerifier?.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = digits(otpCode);
    if (code.length !== 6) {
      setErrorMessage("Enter the 6-digit OTP.");
      return;
    }
    setErrorMessage("");
    setSending(true);
    try {
      const result = await confirmationResult.confirm(code);
      const token = await result.user.getIdToken();
      setFirebaseIdToken(token);
      setOtpVerified(true);
    } catch (err) {
      console.error("OTP verify error:", err);
      setErrorMessage(err?.message || "Invalid OTP. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const validateStep = (s) => {
    setErrorMessage("");
    if (s === 1) {
      if (!fullName.trim()) return err("Full Name is required.");
      if (!dob) return err("Date of Birth is required.");
      if (!gender) return err("Please select your gender.");
      if (!otpVerified) return err("Please verify your mobile number with OTP before proceeding.");
      return true;
    }
    if (s === 2) {
      if (!pinCode || digits(pinCode).length !== 6) return err("Enter a valid 6-digit PIN code.");
      if (!locationConfirmed) return err("Please confirm your detected location.");
      return true;
    }
    return true;
  };

  function err(msg) {
    setErrorMessage(msg);
    return false;
  }

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrorMessage("");
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!consentTerms || !consentPrivacy || !consentStorage || !consentAnalytics) {
      setErrorMessage("Please accept all required consent checkboxes to complete registration.");
      return;
    }
    setErrorMessage("");
    setSubmitting(true);
    try {
      const payload = {
        role: "patient",
        name: fullName.trim(),
        mobile: digits(mobile),
        firebase_id_token: firebaseIdToken,
        date_of_birth: dob,
        gender,
        blood_group: bloodGroup || null,
        pin_code: digits(pinCode),
        country,
        state: locState,
        district,
        mandal,
        city,
        municipality: municipality.trim() || null,
        urban_rural: urbanRural,
        consent_status: true,
        consent_terms: consentTerms,
        consent_privacy: consentPrivacy,
        consent_medical_storage: consentStorage,
        consent_analytics: consentAnalytics,
        consent_research: consentResearch,
        consent_marketing: consentMarketing
      };
      await apiClient.post("/register", payload);
      navigate("/sign-in", { state: { registrationSuccess: true, mobile: digits(mobile) } });
    } catch (err) {
      console.error("Registration error:", err);
      if (err?.status === 409) {
        setErrorMessage("Account already exists. Please sign in.");
      } else {
        setErrorMessage(err?.data?.detail || err?.message || "Registration failed. Please check your inputs.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500 bg-white transition-colors";
  const labelCls = "block text-xs font-bold text-slate-700 mb-1";
  const selectCls = inputCls + " appearance-none";

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col items-center justify-start p-4 sm:p-6 pt-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <img
            src="/image(236).png"
            alt="Vritan Ecosystem"
            className="mx-auto w-full max-w-[280px] h-auto object-contain"
          />
          <p className="text-xs font-semibold text-slate-500 mt-1">Enterprise Healthcare Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8">
          <h1 className="text-xl font-extrabold text-slate-900 text-center tracking-tight mb-1">
            Patient Registration
          </h1>
          <p className="text-xs text-slate-500 text-center mb-6">
            Create your secure Health Locker on the Vritan platform
          </p>

          <ProgressBar current={step} steps={STEPS} />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-slate-800">
              Step {step} of {STEPS.length} — {STEPS[step - 1]}
            </h2>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter your full legal name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className={labelCls}>
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      if (otpVerified) {
                        setOtpVerified(false);
                        setOtpSent(false);
                        setFirebaseIdToken("");
                      }
                    }}
                    disabled={otpVerified || !!presetToken}
                    className={inputCls + " flex-1"}
                  />
                  {!otpVerified && (
                    <button
                      type="button"
                      disabled={sending || (otpSent && countdown > 0)}
                      onClick={handleSendOtp}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl whitespace-nowrap disabled:opacity-50 transition-colors"
                    >
                      {sending ? "Sending..." : otpSent && countdown > 0 ? `Resend (${countdown}s)` : "Send OTP"}
                    </button>
                  )}
                  {otpVerified && (
                    <div className="flex items-center px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-xl">
                      <span className="text-emerald-700 font-extrabold text-xs">✓ Verified</span>
                    </div>
                  )}
                </div>

                {otpSent && !otpVerified && (
                  <div className="flex gap-2">
                    <input
                      ref={otpRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otpCode}
                      onChange={(e) => setOtpCode(digits(e.target.value))}
                      className={inputCls + " flex-1 tracking-widest text-center"}
                    />
                    <button
                      type="button"
                      disabled={sending}
                      onClick={handleVerifyOtp}
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl whitespace-nowrap disabled:opacity-50 transition-colors"
                    >
                      {sending ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>
                  Blood Group <span className="text-slate-400 font-normal text-[10px]">— Optional</span>
                </label>
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={selectCls}>
                  <option value="">Skip for now</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div id="recaptcha-container"></div>
            </div>
          )}

          {/* Region */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>
                  PIN Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN code (e.g. 522201)"
                  value={pinCode}
                  onChange={(e) => {
                    const val = digits(e.target.value);
                    setPinCode(val);
                    setLocationConfirmed(false);
                    if (val.length === 6) lookupPin(val);
                  }}
                  className={inputCls + " tracking-widest text-center text-lg font-mono"}
                />
              </div>

              {pinLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
                  <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Looking up PIN code...
                </div>
              )}

              {pinError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  {pinError}
                </div>
              )}

              {postOffices.length > 0 && !pinLoading && (
                <div className="space-y-3">
                  {postOffices.length > 1 && (
                    <div>
                      <label className={labelCls}>Select your area</label>
                      <select
                        value={selectedPO}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setSelectedPO(idx);
                          applyPO(postOffices[idx]);
                          setLocationConfirmed(false);
                        }}
                        className={selectCls}
                      >
                        {postOffices.map((po, i) => (
                          <option key={i} value={i}>
                            {po.Name} — {po.Block !== "NA" ? po.Block : po.Division}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                      Detected Location
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Country</span>
                        <p className="font-bold text-slate-900">{country}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">State</span>
                        <p className="font-bold text-slate-900">{locState}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">District</span>
                        <p className="font-bold text-slate-900">{district}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Mandal / Taluk</span>
                        <p className="font-bold text-slate-900">{mandal || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">City / Village</span>
                        <p className="font-bold text-slate-900">{city}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Municipality / Ward <span className="text-slate-400 font-normal text-[10px]">— Optional</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Ward 12"
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Urban / Rural Zone</label>
                      <select value={urbanRural} onChange={(e) => setUrbanRural(e.target.value)} className={selectCls}>
                        <option value="Urban">Urban</option>
                        <option value="Rural">Rural</option>
                        <option value="Semi-Urban">Semi-Urban</option>
                      </select>
                    </div>
                  </div>

                  {!locationConfirmed ? (
                    <button
                      type="button"
                      onClick={() => setLocationConfirmed(true)}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      ✓ This is my location — Confirm
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-300 rounded-xl">
                      <span className="text-emerald-700 font-extrabold text-xs">
                        ✓ Location confirmed
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Consent */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentTerms}
                    onChange={(e) => setConsentTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I agree to the <span className="text-emerald-700 font-bold underline">Terms & Conditions</span> of the Vritan platform.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I agree to the <span className="text-emerald-700 font-bold underline">Privacy Policy</span> and data practices.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentStorage}
                    onChange={(e) => setConsentStorage(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I consent to secure, encrypted storage of my medical records on Vritan.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentAnalytics}
                    onChange={(e) => setConsentAnalytics(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I consent to anonymous public health analytics reporting.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentResearch}
                    onChange={(e) => setConsentResearch(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I would like to opt-in to clinical medical research participation <span className="text-slate-400 font-normal">(Optional)</span>.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentMarketing}
                    onChange={(e) => setConsentMarketing(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900 leading-relaxed">
                    I agree to receive health tips and system communications <span className="text-slate-400 font-normal">(Optional)</span>.
                  </span>
                </label>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Identity Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Full Name</span>
                    <p className="font-bold text-slate-900">{fullName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</span>
                    <p className="font-bold text-slate-900">{dob}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Gender</span>
                    <p className="font-bold text-slate-900">{gender}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile</span>
                    <p className="font-bold text-slate-900">{mobile}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-6 gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !consentTerms || !consentPrivacy || !consentStorage || !consentAnalytics}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Complete Onboarding"}
              </button>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <Link to="/join" className="text-slate-600 font-bold hover:text-emerald-700 hover:underline">
              ← Back to Join Vritan
            </Link>
            <span>
              Already have an account?{" "}
              <Link to="/sign-in" className="text-emerald-700 font-bold hover:underline">
                Sign In
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientRegister;
