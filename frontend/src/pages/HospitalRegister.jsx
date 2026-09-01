import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "../api/client";

// Debounced validation helper
function useFieldValidation(value, validatorFn, delay = 500) {
  const [state, setState] = useState({ status: "idle", message: "" }); // idle|checking|ok|error
  const timerRef = useRef(null);

  const validate = useCallback(async () => {
    const trimmed = (value || "").trim();
    if (!trimmed) { setState({ status: "idle", message: "" }); return; }
    setState({ status: "checking", message: "Checking availability…" });
    try {
      const result = await validatorFn(trimmed);
      setState(
        result.available
          ? { status: "ok", message: result.message }
          : { status: "error", message: result.message }
      );
    } catch {
      setState({ status: "idle", message: "" });
    }
  }, [value, validatorFn]);

  const triggerValidation = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(validate, delay);
  }, [validate, delay]);

  return [state, triggerValidation];
}

function ProgressBar({ current, steps }) {
  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-xl mx-auto mb-8">
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

function HospitalRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const STEPS = ["Identity", "Location", "Admin Profile", "Documents", "Review"];

  // Step 1: Identity
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [orgType, setOrgType] = useState("HOSPITAL");
  const [regNumber, setRegNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [nabhStatus, setNabhStatus] = useState("Not Accredited");
  const [nablStatus, setNablStatus] = useState("Not Accredited");
  const [yearEstablished, setYearEstablished] = useState("");
  const [website, setWebsite] = useState("");

  // Step 2: Location
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [mandal, setMandal] = useState("");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Step 3: Admin User
  const [adminName, setAdminName] = useState("");
  const [adminDesignation, setAdminDesignation] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 4: Documents (Simulating URLs for demo/file select)
  const [regCertFile, setRegCertFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [nabhCertFile, setNabhCertFile] = useState(null);
  const [gstCertFile, setGstCertFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  // Legal Declaration
  const [acceptDeclaration, setAcceptDeclaration] = useState(false);

  // Status
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [applicationId, setApplicationId] = useState("");

  // Real-time validation API base
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const validateField = async (endpoint, params) => {
    const url = `${API_BASE}${endpoint}?${new URLSearchParams(params)}`;
    const res = await fetch(url);
    return res.json();
  };

  // Validators per field
  const emailValidator = useCallback((v) => validateField("/validate/email", { email: v }), [API_BASE]);
  const phoneValidator = useCallback((v) => validateField("/validate/phone", { phone: v }), [API_BASE]);
  const orgNameValidator = useCallback((v) => validateField("/validate/org-name", { name: v }), [API_BASE]);
  const regNumValidator = useCallback((v) => validateField("/validate/reg-number", { reg_number: v }), [API_BASE]);

  const [emailValidation, triggerEmailValidation] = useFieldValidation(adminEmail, emailValidator);
  const [phoneValidation, triggerPhoneValidation] = useFieldValidation(adminPhone, phoneValidator);
  const [orgNameValidation, triggerOrgNameValidation] = useFieldValidation(name, orgNameValidator);
  const [regNumValidation, triggerRegNumValidation] = useFieldValidation(regNumber, regNumValidator);

  // Timer effect for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setErrorMessage("Please enter a valid 6-digit OTP.");
      return;
    }
    setErrorMessage("");
    setOtpLoading(true);
    try {
      await apiClient.post("/verify-email-otp", {
        email: adminEmail,
        otp: otp
      });
      setOtpVerified(true);
    } catch (err) {
      setErrorMessage(err.message || "OTP verification failed. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setErrorMessage("");
    setResendLoading(true);
    try {
      await apiClient.post("/resend-email-otp", { email: adminEmail });
      setResendCooldown(60);
      setSuccessMessage("A new OTP has been sent to your email.");
    } catch (err) {
      setErrorMessage(err.message || "Resend OTP failed.");
    } finally {
      setResendLoading(false);
    }
  };

  const goNext = () => {
    setErrorMessage("");
    if (step === 1) {
      if (!name || !legalName || !regNumber) {
        setErrorMessage("Please fill all mandatory identity fields.");
        return;
      }
      if (orgNameValidation.status === "error") {
        setErrorMessage(orgNameValidation.message);
        return;
      }
      if (regNumValidation.status === "error") {
        setErrorMessage(regNumValidation.message);
        return;
      }
    } else if (step === 2) {
      if (!state || !city || !pincode || !address) {
        setErrorMessage("Please fill all mandatory location fields.");
        return;
      }
    } else if (step === 3) {
      if (!adminName || !adminDesignation || !adminEmail || !adminPhone || !password) {
        setErrorMessage("Please fill all administrator fields.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }
      if (emailValidation.status === "error") {
        setErrorMessage(emailValidation.message);
        return;
      }
      if (phoneValidation.status === "error") {
        setErrorMessage(phoneValidation.message);
        return;
      }
      if (emailValidation.status === "checking" || phoneValidation.status === "checking") {
        setErrorMessage("Please wait for validation to complete.");
        return;
      }
    } else if (step === 4) {
      if (!regCertFile || !licenseFile) {
        setErrorMessage("Registration Certificate and Government License are mandatory.");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrorMessage("");
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptDeclaration) {
      setErrorMessage("You must accept the legal declaration before submitting.");
      return;
    }

    setErrorMessage("");
    setSubmitting(true);

    // Simulating file upload base64/mock paths
    const payload = {
      name,
      legal_name: legalName,
      organization_type: orgType,
      registration_number: regNumber,
      gst_number: gstNumber,
      nabh_status: nabhStatus,
      nabl_status: nablStatus,
      year_established: parseInt(yearEstablished) || null,
      website,
      country,
      state,
      district,
      city,
      mandal,
      pincode,
      address,
      latitude,
      longitude,
      admin_name: adminName,
      admin_designation: adminDesignation,
      admin_email: adminEmail,
      admin_phone: adminPhone,
      password,
      reg_cert_url: regCertFile ? `/uploads/${regCertFile.name}` : null,
      hospital_license_url: licenseFile ? `/uploads/${licenseFile.name}` : null,
      nabh_cert_url: nabhCertFile ? `/uploads/${nabhCertFile.name}` : null,
      gst_doc_url: gstCertFile ? `/uploads/${gstCertFile.name}` : null,
      logo_url: logoFile ? `/uploads/${logoFile.name}` : null,
    };

    try {
      const data = await apiClient.post("/register-hospital", payload);
      setSuccessMessage(data.message || "Registration submitted successfully!");
      if (data.application_id) setApplicationId(data.application_id);
      setResendCooldown(60);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Registration submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500 bg-white transition-colors";
  const labelCls = "block text-xs font-bold text-slate-700 mb-1";
  const selectCls = inputCls + " appearance-none";

  // Validation state display helpers
  const ValidationHint = ({ v }) => {
    if (v.status === "idle") return null;
    if (v.status === "checking") return <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>⏳ {v.message}</span>;
    if (v.status === "ok") return <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ {v.message}</span>;
    return <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>⚠️ {v.message}</span>;
  };

  const fieldBorder = (v) =>
    v.status === "error" ? "border-red-400" : v.status === "ok" ? "border-emerald-400" : "border-slate-200";

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col items-center justify-start p-4 sm:p-6 pt-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Vritan Healthcare Portal</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Enterprise Hospital Organization Registration</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
          {successMessage ? (
            <div className="flex items-center justify-between max-w-md mx-auto mb-8 font-sans">
              {[
                { label: "Registration Details", isCompleted: true },
                { label: "Email Verification", isCompleted: otpVerified, isActive: !otpVerified },
                { label: "Admin Approval", isCompleted: false, isActive: otpVerified }
              ].map((s, idx) => {
                const isCompleted = s.isCompleted;
                const isActive = s.isActive;
                
                return (
                  <div key={idx} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-1 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${
                        isCompleted ? "bg-emerald-600 border-emerald-600 text-white" :
                        isActive ? "bg-emerald-50 border-emerald-600 text-emerald-700 shadow-sm" :
                        "bg-slate-100 border-slate-200 text-slate-400"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <span className={`text-[10px] font-bold mt-2 truncate max-w-[90px] ${isActive ? "text-emerald-800" : "text-slate-400"}`}>
                        {s.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className={`h-0.5 flex-1 -mt-5 transition-all ${
                        isCompleted ? "bg-emerald-600" : "bg-slate-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <ProgressBar current={step} steps={STEPS} />
          )}

          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-rose-800 text-xs font-semibold">
              ⚠️ {errorMessage}
            </div>
          )}

          {successMessage ? (
            otpVerified ? (
              <div className="text-center py-8 space-y-6">
                {/* Success Icon */}
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-4xl border-2 border-emerald-200 shadow-sm">
                    🎉
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold text-slate-950">Application Submitted!</h2>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mt-2">
                    Your email has been verified. Your application is now under review by the Vritan team.
                  </p>
                </div>

                {/* Application ID Card */}
                {applicationId && (
                  <div className="max-w-sm mx-auto bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-left">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Your Application ID</div>
                    <div className="text-2xl font-black text-emerald-900 font-mono tracking-wider">{applicationId}</div>
                    <p className="text-xs text-emerald-700 mt-2 font-medium">
                      Save this ID to track your registration status. You will need it to check your application progress.
                    </p>
                  </div>
                )}

                {/* Status Steps */}
                <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">What Happens Next</div>
                  {[
                    { icon: "🔍", title: "Document Verification", desc: "Our team will verify your submitted documents" },
                    { icon: "✅", title: "Approval Decision", desc: "Typically within 2–5 business days" },
                    { icon: "📧", title: "Approval Email", desc: "You'll receive your Vritan ID and a password setup link" },
                    { icon: "🔐", title: "Set Password & Login", desc: "Complete account activation and access your dashboard" },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="text-xl mt-0.5">{s.icon}</div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{s.title}</div>
                        <div className="text-xs text-slate-500">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notice: NO login button */}
                <div className="max-w-sm mx-auto bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 font-semibold text-left">
                  ℹ️ You cannot log in until your application is approved. You will receive an email with your Vritan ID and a password setup link once approved.
                </div>

                {/* Status Tracker Link */}
                {applicationId && (
                  <div className="pt-2">
                    <Link
                      to={`/application-status?app_id=${applicationId}`}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                    >
                      📊 Track Application Status
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-extrabold text-slate-950">Enter Email Verification OTP</h2>
                  <p className="text-slate-600 text-sm max-w-md mx-auto">
                    A 6-digit verification code has been sent to your administrator email <strong className="text-slate-900">{adminEmail}</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4 max-w-sm mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 text-center">6-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full text-center tracking-[1em] text-2xl font-extrabold px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-white transition-colors"
                      placeholder="000000"
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={otpLoading}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                      {otpLoading ? "Verifying..." : "Verify OTP"}
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || resendLoading}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
                    >
                      {resendLoading ? "Resending..." : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend OTP"}
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1 – Identity */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Organization Identity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Organization Display Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Apollo Hyderabad"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={triggerOrgNameValidation}
                        className={`${inputCls} ${fieldBorder(orgNameValidation)}`}
                      />
                      <div className="mt-1"><ValidationHint v={orgNameValidation} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>Legal Registered Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Apollo Hospitals Enterprise Ltd"
                        required
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Organization Type *</label>
                      <select
                        value={orgType}
                        onChange={(e) => setOrgType(e.target.value)}
                        className={selectCls}
                      >
                        <option value="HOSPITAL">Hospital</option>
                        <option value="CLINIC">Clinic</option>
                        <option value="MEDICAL_COLLEGE">Medical College</option>
                        <option value="DIAGNOSTIC_CENTRE">Diagnostic Centre</option>
                        <option value="MULTI_SPECIALITY_CENTRE">Multi-Speciality Centre</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Registration Number *</label>
                      <input
                        type="text"
                        placeholder="Reg / Licence No."
                        required
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        onBlur={triggerRegNumValidation}
                        className={`${inputCls} ${fieldBorder(regNumValidation)}`}
                      />
                      <div className="mt-1"><ValidationHint v={regNumValidation} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>GST Number (Optional)</label>
                      <input
                        type="text"
                        placeholder="22AAAAA0000A1Z5"
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>NABH Accreditation Status</label>
                      <select
                        value={nabhStatus}
                        onChange={(e) => setNabhStatus(e.target.value)}
                        className={selectCls}
                      >
                        <option value="Not Accredited">Not Accredited</option>
                        <option value="Accredited">Accredited</option>
                        <option value="Applied">Applied/Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>NABL Accreditation Status</label>
                      <select
                        value={nablStatus}
                        onChange={(e) => setNablStatus(e.target.value)}
                        className={selectCls}
                      >
                        <option value="Not Accredited">Not Accredited</option>
                        <option value="Accredited">Accredited</option>
                        <option value="Applied">Applied/Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Year Established</label>
                      <input
                        type="number"
                        placeholder="e.g. 1983"
                        value={yearEstablished}
                        onChange={(e) => setYearEstablished(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Official Website</label>
                    <input
                      type="url"
                      placeholder="https://hospital.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Step 2 – Location */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Physical Location</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Country *</label>
                      <input
                        type="text"
                        required
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>State *</label>
                      <input
                        type="text"
                        placeholder="e.g. Telangana"
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>District</label>
                      <input
                        type="text"
                        placeholder="e.g. Hyderabad"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>City / Town *</label>
                      <input
                        type="text"
                        placeholder="e.g. Jubilee Hills"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Mandal / Taluk</label>
                      <input
                        type="text"
                        placeholder="e.g. Khairatabad"
                        value={mandal}
                        onChange={(e) => setMandal(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>PIN Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. 500033"
                        required
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Complete Physical Address *</label>
                    <textarea
                      placeholder="Street, Landmark, Building Number..."
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={inputCls + " h-20 resize-none"}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Google Maps Latitude (Optional)</label>
                      <input
                        type="text"
                        placeholder="17.4321"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Google Maps Longitude (Optional)</label>
                      <input
                        type="text"
                        placeholder="78.4321"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 – Administrator Profile */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Primary Administrator</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Ramesh Kumar"
                        required
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Designation *</label>
                      <input
                        type="text"
                        placeholder="e.g. Medical Director / Chief Administrator"
                        required
                        value={adminDesignation}
                        onChange={(e) => setAdminDesignation(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Official Email *</label>
                      <input
                        type="email"
                        placeholder="admin@hospital.com"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        onBlur={triggerEmailValidation}
                        className={`${inputCls} ${fieldBorder(emailValidation)}`}
                      />
                      <div className="mt-1"><ValidationHint v={emailValidation} /></div>
                    </div>
                    <div>
                      <label className={labelCls}>Mobile Number *</label>
                      <input
                        type="tel"
                        placeholder="+91 XXXXXXXXXX"
                        required
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        onBlur={triggerPhoneValidation}
                        className={`${inputCls} ${fieldBorder(phoneValidation)}`}
                      />
                      <div className="mt-1"><ValidationHint v={phoneValidation} /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Password *</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Confirm Password *</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4 – Document Uploads */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Verification Documents</h3>
                  <div>
                    <label className={labelCls}>Registration Certificate * (PDF/Image)</label>
                    <input
                      type="file"
                      required
                      onChange={(e) => setRegCertFile(e.target.files[0])}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Government Operating License * (PDF/Image)</label>
                    <input
                      type="file"
                      required
                      onChange={(e) => setLicenseFile(e.target.files[0])}
                      className={inputCls}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>NABH/NABL Accreditation Certificate</label>
                      <input
                        type="file"
                        onChange={(e) => setNabhCertFile(e.target.files[0])}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>GST Certificate</label>
                      <input
                        type="file"
                        onChange={(e) => setGstCertFile(e.target.files[0])}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Hospital Logo (Optional)</label>
                    <input
                      type="file"
                      onChange={(e) => setLogoFile(e.target.files[0])}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Step 5 – Review & Submit */}
              {step === 5 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Review Summary</h3>
                  <div className="bg-slate-50 p-6 rounded-xl border space-y-4 text-sm">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">1. Organization Details</h4>
                      <p><strong>Name:</strong> {name}</p>
                      <p><strong>Legal Name:</strong> {legalName}</p>
                      <p><strong>Type:</strong> {orgType}</p>
                      <p><strong>Reg Number:</strong> {regNumber}</p>
                    </div>

                    <hr />

                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">2. Physical Location</h4>
                      <p><strong>Address:</strong> {address}, {city}, {state}, {pincode}</p>
                      {latitude && longitude && <p><strong>Coordinates:</strong> {latitude}, {longitude}</p>}
                    </div>

                    <hr />

                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">3. Primary Administrator</h4>
                      <p><strong>Name:</strong> {adminName} ({adminDesignation})</p>
                      <p><strong>Email:</strong> {adminEmail}</p>
                      <p><strong>Mobile:</strong> {adminPhone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <input
                      type="checkbox"
                      id="declaration"
                      checked={acceptDeclaration}
                      onChange={(e) => setAcceptDeclaration(e.target.checked)}
                      className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <label htmlFor="declaration" className="text-xs font-bold text-emerald-950 cursor-pointer">
                      I hereby declare that all information, documents, and credentials submitted during this onboarding process are true, authentic, and verified under official hospital capacity. Vritan reserves the right to suspend platform rights if discrepancies are found.
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
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

                {step < STEPS.length ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <Link to="/join" className="text-slate-600 font-bold hover:text-emerald-700 hover:underline">
              ← Back to Join Vritan
            </Link>
            <span>
              Already registered?{" "}
              <Link to="/login/hospital" className="text-emerald-600 font-bold hover:underline">
                Sign In
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HospitalRegister;
