import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiClient } from "../api/client";

const normalizeError = (err, fallback) => {
  if (!err) return fallback;
  const payload = err?.data?.detail || err?.response?.data?.detail || err?.detail || err?.data?.message || err?.response?.data?.message || err?.message;
  
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return payload.map(e => {
      if (typeof e === "string") return e;
      return e?.msg || e?.message || "Validation error";
    }).join(" • ");
  }
  if (typeof payload === "object") {
    return payload.msg || payload.message || "An unexpected error occurred.";
  }
  return fallback;
};

/**
 * Register.jsx — Enterprise Registration for Doctor, Hospital, Pharmacy, Government.
 *
 * Patient registration has been moved to PatientRegister.jsx (multi-step wizard).
 * Each registration page belongs to exactly one stakeholder.
 * There is NO role selector — the stakeholder is determined by the URL route parameter.
 */
function Register() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const role = params.role || searchParams.get("role") || "doctor";

  const inviteToken = searchParams.get("invite");

  // Validate Invitation Token on Mount and redirect to the correct role onboarding
  useEffect(() => {
    const validateAndRoute = async () => {
      if (!inviteToken) {
        // Standard redirect if no invite token
        if (role === "patient") {
          navigate("/register/patient", { replace: true });
        } else if (role === "doctor") {
          navigate("/register/doctor", { replace: true });
        }
        return;
      }

      try {
        const res = await apiClient.post("/organizations/invitations/validate", { token: inviteToken });
        if (res.valid) {
          const targetRole = res.role || "doctor";
          if (["doctor", "patient", "hospital"].includes(targetRole)) {
            navigate(`/register/${targetRole}?invite=${inviteToken}`, { replace: true });
          } else if (role !== targetRole) {
            // Other roles can register on the generic Stakeholder register page
            navigate(`/register/${targetRole}?invite=${inviteToken}`, { replace: true });
          } else {
            // Already at the correct route, pre-fill and freeze email
            setEmail(res.email || "");
          }
        }
      } catch (err) {
        setErrorMessage(normalizeError(err, "Invalid or expired invitation link."));
      }
    };

    validateAndRoute();
  }, [inviteToken, role, navigate]);

  // Shared
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [vritanIdGenerated, setVritanIdGenerated] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // OTP Wizard Steps
  const [step, setStep] = useState("form"); // "form", "otp", "approval"
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Doctor Scenarios
  const [doctorScenario, setDoctorScenario] = useState("registered");
  const [hospitalVritanId, setHospitalVritanId] = useState("");
  const [unregisteredHospitalName, setUnregisteredHospitalName] = useState("");
  const [unregisteredHospitalAddress, setUnregisteredHospitalAddress] = useState("");
  const [practiceType, setPracticeType] = useState("Private Clinic");
  const [clinicName, setClinicName] = useState("");
  const [medicalLicenseNumber, setMedicalLicenseNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");

  // Hospital Fields
  const [hospitalName, setHospitalName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Pharmacy Fields
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyLicense, setPharmacyLicense] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");

  // Government Authority Fields
  const [agencyName, setAgencyName] = useState("");
  const [jurisdictionLevel, setJurisdictionLevel] = useState("National");
  const [jurisdictionRegion, setJurisdictionRegion] = useState("India");
  const [officerName, setOfficerName] = useState("");
  const [designation, setDesignation] = useState("");

  // Laboratory Fields
  const [labName, setLabName] = useState("");
  const [labLicense, setLabLicense] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [techName, setTechName] = useState("");
  const [techEmployeeId, setTechEmployeeId] = useState("");
  const [labFile, setLabFile] = useState(null);

  const TITLES = {
    doctor: "Doctor Registration",
    hospital: "Hospital Organization Registration",
    pharmacy: "Pharmacy Registration",
    government: "Government Health Authority Registration",
    laboratory: "Laboratory Registration",
    lab: "Laboratory Registration",
  };

  const SUBTITLES = {
    doctor: "Register as a licensed clinician on the Vritan EHR platform",
    hospital: "Onboard your hospital network to the Vritan healthcare ecosystem",
    pharmacy: "Connect your pharmacy to the Vritan prescription network",
    government: "Establish government health authority access for population analytics",
    laboratory: "Connect your laboratory to the Vritan diagnostic network",
    lab: "Connect your laboratory to the Vritan diagnostic network",
  };

  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError("Please enter the 6-digit OTP code.");
      return;
    }
    setOtpVerifying(true);
    setOtpError("");
    setOtpSuccess("");
    try {
      await apiClient.post("/verify-email-otp", {
        email: registeredEmail.trim().toLowerCase(),
        otp: otpCode.trim()
      });
      setStep("approval");
    } catch (err) {
      setOtpError(normalizeError(err, "Invalid or expired OTP code."));
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setOtpError("");
    setOtpSuccess("");
    try {
      await apiClient.post("/resend-email-otp", {
        email: registeredEmail.trim().toLowerCase()
      });
      setOtpSuccess("A new OTP code has been sent to your email.");
      setResendCountdown(60);
    } catch (err) {
      setOtpError(normalizeError(err, "Failed to resend OTP."));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setVritanIdGenerated("");

    try {
      const regEmail = email.trim().toLowerCase();
      let res;

      if (role === "pharmacy") {
        res = await apiClient.post("/register-pharmacy", {
          pharmacy_name: pharmacyName,
          license_number: pharmacyLicense,
          address: pharmacyAddress,
          email: regEmail,
          phone,
          password,
        });
        setVritanIdGenerated(res?.vritan_id || "");
      } else if (role === "government") {
        res = await apiClient.post("/register-gov-authority", {
          agency_name: agencyName,
          jurisdiction_level: jurisdictionLevel,
          jurisdiction_region: jurisdictionRegion,
          official_email: regEmail,
          official_phone: phone,
          authorized_officer_name: officerName,
          designation,
          password,
        });
        setVritanIdGenerated(res?.vritan_id || "");
      } else if (role === "laboratory" || role === "lab") {
        const formData = new FormData();
        formData.append("lab_name", labName);
        formData.append("lab_license_number", labLicense);
        formData.append("lab_address", labAddress);
        formData.append("tech_name", techName);
        formData.append("tech_employee_id", techEmployeeId);
        formData.append("tech_email", regEmail);
        formData.append("tech_phone", phone);
        formData.append("password", password);
        if (labFile) {
          formData.append("file", labFile);
        }
        res = await apiClient.post("/register-lab", formData);
      } else if (role === "doctor") {
        res = await apiClient.post("/register/doctor", {
          role: "doctor",
          name,
          email: regEmail,
          phone,
          medical_license_number: medicalLicenseNumber,
          years_of_experience: parseInt(yearsOfExperience) || 0,
          hospital:
            doctorScenario === "registered"
              ? hospitalVritanId
              : doctorScenario === "unregistered"
              ? unregisteredHospitalName
              : clinicName || "Independent Practice",
          specialization,
          password,
        });
        setVritanIdGenerated(res?.vritan_id || "");
      }

      setRegisteredEmail(regEmail);
      setSuccessMessage(res?.message || "Registration completed successfully! Please verify your email.");
      setStep("otp");
    } catch (err) {
      setErrorMessage(normalizeError(err, "Registration failed. Please check inputs."));
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = ({ currentStep }) => {
    const steps = [
      { id: "form", label: "Registration Details" },
      { id: "otp", label: "Email Verification" },
      { id: "approval", label: "Admin Approval" }
    ];

    return (
      <div className="flex items-center justify-between max-w-md mx-auto mb-8 font-sans">
        {steps.map((s, idx) => {
          const isCompleted = 
            (currentStep === "otp" && idx === 0) || 
            (currentStep === "approval" && (idx === 0 || idx === 1));
          const isActive = currentStep === s.id;
          
          return (
            <div key={s.id} className="flex-1 flex items-center">
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
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 -mt-5 transition-all ${
                  isCompleted ? "bg-emerald-600" : "bg-slate-200"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Don't render anything for patient — they get redirected
  if (role === "patient") return null;

  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500 bg-white transition-colors";
  const labelCls = "block text-xs font-bold text-slate-700 mb-1";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <img
            src="/image(236).png"
            alt="Vritan Ecosystem"
            className="mx-auto w-full max-w-[280px] h-auto object-contain"
          />
          <p className="text-xs font-semibold text-slate-500 mt-1">Enterprise Healthcare Platform</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* ─── STEP 1: Registration Form ─── */}
        {step === "form" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {TITLES[role] || "Registration"}
              </h1>
              <p className="text-xs text-slate-500 mt-1">{SUBTITLES[role] || ""}</p>
            </div>

            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-red-800 font-extrabold uppercase text-[10px] tracking-wider">
                  <span>⚠️</span> Registration Error
                </div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Pharmacy */}
              {role === "pharmacy" && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Pharmacy Details</h3>
                  <div>
                    <label className={labelCls}>Pharmacy Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Drug License Number <span className="text-red-500">*</span></label>
                    <input type="text" required value={pharmacyLicense} onChange={(e) => setPharmacyLicense(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Address</label>
                    <input type="text" value={pharmacyAddress} onChange={(e) => setPharmacyAddress(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} disabled={!!inviteToken} />
                  </div>
                  <div>
                    <label className={labelCls}>Account Password <span className="text-red-500">*</span></label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* Government */}
              {role === "government" && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Government Authority Onboarding</h3>
                  <div>
                    <label className={labelCls}>Agency Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Jurisdiction Level</label>
                      <select value={jurisdictionLevel} onChange={(e) => setJurisdictionLevel(e.target.value)} className={inputCls}>
                        <option value="National">National Level</option>
                        <option value="State">State Level</option>
                        <option value="District">District Health Office</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Region</label>
                      <input type="text" placeholder="e.g. Maharashtra" value={jurisdictionRegion} onChange={(e) => setJurisdictionRegion(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Authorized Officer Name</label>
                      <input type="text" value={officerName} onChange={(e) => setOfficerName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Designation</label>
                      <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Official Email <span className="text-red-500">*</span></label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} disabled={!!inviteToken} />
                  </div>
                  <div>
                    <label className={labelCls}>Account Password <span className="text-red-500">*</span></label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}

              {/* Laboratory / Lab */}
              {(role === "laboratory" || role === "lab") && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900">Laboratory Details</h3>
                  <div>
                    <label className={labelCls}>Laboratory Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={labName} onChange={(e) => setLabName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>License Number <span className="text-red-500">*</span></label>
                      <input type="text" required value={labLicense} onChange={(e) => setLabLicense(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Laboratory Address</label>
                      <input type="text" value={labAddress} onChange={(e) => setLabAddress(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 pt-2">Primary Technician Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Technician Name <span className="text-red-500">*</span></label>
                      <input type="text" required value={techName} onChange={(e) => setTechName(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Employee ID <span className="text-red-500">*</span></label>
                      <input type="text" required value={techEmployeeId} onChange={(e) => setTechEmployeeId(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Official Email <span className="text-red-500">*</span></label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} disabled={!!inviteToken} />
                  </div>
                  <div>
                    <label className={labelCls}>Account Password <span className="text-red-500">*</span></label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Verification Document (License PDF / Image) <span className="text-red-500">*</span></label>
                    <input type="file" required onChange={(e) => setLabFile(e.target.files[0])} className="w-full text-xs font-semibold text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-sm transition-colors disabled:opacity-50"
              >
                {submitting
                  ? "Registering..."
                  : `Complete ${(role === "lab_tech" ? "Laboratory" : role || "").charAt(0).toUpperCase() + (role === "lab_tech" ? "laboratory" : role || "").slice(1)} Registration`}
              </button>
            </form>
          </div>
        )}

        {/* ─── STEP 2: Email Verification (OTP) ─── */}
        {step === "otp" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Verify Your Email Address</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                We've sent a 6-digit One-Time Password (OTP) to your official email: <span className="font-bold text-slate-800">{registeredEmail}</span>.
                Please check your inbox (and spam folder) and enter it below.
              </p>
            </div>

            {otpError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                {otpError}
              </div>
            )}

            {otpSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
                {otpSuccess}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className={labelCls}>6-Digit OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="Enter OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-center tracking-widest text-lg font-extrabold focus:outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={otpVerifying || otpCode.length !== 6}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm text-sm transition-colors disabled:opacity-50"
              >
                {otpVerifying ? "Verifying..." : "Verify Code"}
              </button>
            </form>

            <div className="text-center text-xs">
              {resendCountdown > 0 ? (
                <span className="text-slate-500">Resend code in {resendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Resend Verification Email OTP
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 3: Approval Pending ─── */}
        {step === "approval" && (
          <div className="p-6 text-center space-y-6 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner animate-bounce">
              ⏳
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Registration Under Review</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                Thank you! Your official email <span className="font-bold text-slate-800">{registeredEmail}</span> has been verified.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto pt-2">
                Your application has been successfully submitted and is awaiting approval by the Super Admin. You will receive an email confirmation once approved.
              </p>
            </div>

            {vritanIdGenerated && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl inline-block shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Assigned Vritan ID
                </span>
                <span className="text-lg font-mono font-extrabold text-slate-800">
                  {vritanIdGenerated}
                </span>
              </div>
            )}

            <div className="pt-2">
              <Link
                to="/sign-in"
                className="inline-block px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
              >
                Proceed to Sign In &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Footer Navigation — ONLY Back to Join Vritan and Sign In */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <Link to="/join" className="text-slate-600 font-bold hover:text-emerald-700 hover:underline">
            ← Back to Join Vritan
          </Link>
          <span>
            Already onboarded?{" "}
            <Link to="/sign-in" className="text-emerald-700 font-bold hover:underline">
              Sign In
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Register;
