import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiClient } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
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

function DoctorRegister() {
  const navigate = useNavigate();
  const digits = (val) => String(val || "").replace(/\D/g, "");
  const [step, setStep] = useState(1);
  const STEPS = ["Identity", "Credentials", "Practice Info", "Verification"];

  /* Step 1 – Identity */
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /* Step 2 – Credentials */
  const [licenseNumber, setLicenseNumber] = useState("");
  const [registrationCouncil, setRegistrationCouncil] = useState("");
  const [qualification, setQualification] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [secondarySpecialization, setSecondarySpecialization] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState("");

  /* Step 3 – Practice Info */
  const [practiceType, setPracticeType] = useState("Hospital / Healthcare Organization");
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [hospitalsList, setHospitalsList] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [clinicPinCode, setClinicPinCode] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicState, setClinicState] = useState("");
  const [clinicDistrict, setClinicDistrict] = useState("");
  const [clinicMandal, setClinicMandal] = useState("");
  const [clinicCity, setClinicCity] = useState("");
  const [consultationModes, setConsultationModes] = useState("Both");

  /* Step 4 – Verification */
  const [licenseFile, setLicenseFile] = useState(null);
  const [identityProofFile, setIdentityProofFile] = useState(null);

  /* Shared State */
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [vritanIdGenerated, setVritanIdGenerated] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Invitation States */
  const [inviteToken, setInviteToken] = useState("");
  const [invitingOrgName, setInvitingOrgName] = useState("");
  const [invitingDesignation, setInvitingDesignation] = useState("");

  // Validate Invitation Token on Mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) {
      setInviteToken(token);
      apiClient.post("/organizations/invitations/validate", { token })
        .then((res) => {
          if (res.valid) {
            setEmail(res.email || "");
            setInvitingOrgName(res.organization_name || "");
            setInvitingDesignation(res.designation || "");
            setHospitalSearch(res.organization_name || "");
            setSelectedHospital({ name: res.organization_name });
            setPracticeType("Hospital / Healthcare Organization");
          }
        })
        .catch((err) => {
          setErrorMessage(err.data?.detail || err.message || "Failed to validate invitation token.");
        });
    }
  }, []);

  // Search hospitals based on text input
  useEffect(() => {
    if (practiceType !== "Hospital / Healthcare Organization" || !hospitalSearch.trim()) {
      setHospitalsList([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/v1/hospitals/search?q=${encodeURIComponent(hospitalSearch)}`);
        const result = await response.json();
        setHospitalsList(result.data?.items || result.data || result || []);
      } catch (err) {
        console.error("Error searching hospitals:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [hospitalSearch, practiceType]);

  // Pincode lookup for independent practices
  useEffect(() => {
    if ((practiceType !== "Independent Clinic" && practiceType !== "Hybrid") || clinicPinCode.length !== 6) return;
    const fetchPin = async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${clinicPinCode}`);
        const data = await res.json();
        if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0];
          setClinicState(po.State || "");
          setClinicDistrict(po.District || "");
          setClinicMandal(po.Block !== "NA" ? po.Block : po.Division || "");
          setClinicCity(po.Name || "");
        }
      } catch (err) {
        console.error("PIN lookup error:", err);
      }
    };
    fetchPin();
  }, [clinicPinCode, practiceType]);

  const validateStep = (s) => {
    setErrorMessage("");
    if (s === 1) {
      if (!fullName.trim()) return err("Full Name is required.");
      if (!gender) return err("Select gender.");
      if (!dob) return err("Date of Birth is required.");
      if (!mobile.trim()) return err("Mobile Number is required.");
      if (!email.trim()) return err("Official Email is required.");
      if (!password || password.length < 8) return err("Password must be at least 8 characters.");
      if (password !== confirmPassword) return err("Passwords do not match.");
    }
    if (s === 2) {
      if (!licenseNumber.trim()) return err("Medical Registration License Number is required.");
      if (!registrationCouncil.trim()) return err("Registration Council is required.");
      if (!qualification.trim()) return err("Qualification (e.g. MBBS) is required.");
      if (!specialization.trim()) return err("Primary Specialization is required.");
      if (!yearsOfExperience || Number(yearsOfExperience) < 0) return err("Enter valid years of experience.");
    }
    if (s === 3) {
      if ((practiceType === "Hospital / Healthcare Organization" || practiceType === "Hybrid") && !selectedHospital) {
        return err("Please search and select a registered hospital affiliation from the suggestions list.");
      }
      if (practiceType === "Independent Clinic" || practiceType === "Hybrid") {
        if (!clinicPinCode || clinicPinCode.length !== 6) return err("Enter a valid 6-digit PIN code.");
        if (!clinicAddress.trim()) return err("Clinic Address is required.");
      }
    }
    return true;
  };

  const err = (msg) => {
    setErrorMessage(msg);
    return false;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrorMessage("");
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

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
        email: email.trim().toLowerCase(),
        otp: otpCode.trim()
      });
      setStep(6);
    } catch (err) {
      setOtpError(err?.data?.detail || err?.message || "Invalid or expired OTP code.");
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
        email: email.trim().toLowerCase()
      });
      setOtpSuccess("A new OTP code has been sent to your email.");
      setResendCountdown(60);
    } catch (err) {
      setOtpError(err?.data?.detail || err?.message || "Failed to resend OTP.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!licenseFile) {
      setErrorMessage("Medical Registration Certificate is mandatory.");
      return;
    }
    if (!identityProofFile) {
      setErrorMessage("Government-issued Identity Proof is mandatory.");
      return;
    }

    setErrorMessage("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", fullName.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("phone", mobile.trim());
      formData.append("medical_license_number", licenseNumber.trim());
      formData.append("years_of_experience", parseInt(yearsOfExperience) || 0);
      formData.append("password", password);
      formData.append("specialization", specialization.trim());
      formData.append("secondary_specialization", secondarySpecialization.trim());
      formData.append("qualification", qualification.trim());
      formData.append("registration_council", registrationCouncil.trim());
      formData.append("languages_spoken", languagesSpoken.trim());
      formData.append("consultation_modes", consultationModes);
      formData.append("practice_type", practiceType);
      
      if (practiceType === "Hospital / Healthcare Organization") {
        formData.append("hospital", selectedHospital?.name || hospitalSearch);
        if (selectedHospital?.vritan_id) {
          formData.append("hospital_vritan_id", selectedHospital.vritan_id);
        }
      } else if (practiceType === "Independent Clinic") {
        formData.append("clinic_name", clinicName.trim());
        formData.append("clinic_address", clinicAddress.trim());
        formData.append("clinic_pin_code", clinicPinCode.trim());
        formData.append("clinic_state", clinicState);
        formData.append("clinic_district", clinicDistrict);
        formData.append("clinic_mandal", clinicMandal);
        formData.append("clinic_city", clinicCity);
      } else if (practiceType === "Hybrid") {
        formData.append("hospital", selectedHospital?.name || hospitalSearch);
        if (selectedHospital?.vritan_id) {
          formData.append("hospital_vritan_id", selectedHospital.vritan_id);
        }
        formData.append("clinic_name", clinicName.trim());
        formData.append("clinic_address", clinicAddress.trim());
        formData.append("clinic_pin_code", clinicPinCode.trim());
        formData.append("clinic_state", clinicState);
        formData.append("clinic_district", clinicDistrict);
        formData.append("clinic_mandal", clinicMandal);
        formData.append("clinic_city", clinicCity);
      } else {
        formData.append("hospital", "Telemedicine Practice");
      }

      formData.append("file", licenseFile);
      formData.append("identity_proof", identityProofFile);
      if (inviteToken) {
        formData.append("invite_token", inviteToken);
      }

      // Perform multipart POST request
      const response = await fetch(`${API_BASE}/register-doctor`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration submission failed.");
      }

      // Handle invitation accepted redirect path (clean redirection to /sign-in)
      if (data.status === "APPROVED") {
        alert("Registration successful! Welcome to Vritan. Please sign in with your credentials.");
        window.location.href = "/sign-in";
        return;
      }

      setVritanIdGenerated(data.vritan_id || "");
      setStep(5);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred during submission.");
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
            Doctor Registration & Credentialing
          </h1>
          <p className="text-xs text-slate-500 text-center mb-6">
            Register your clinical identity on the Vritan platform
          </p>

          {step <= 4 ? (
            <>
              <ProgressBar current={step} steps={STEPS} />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-slate-800">
                  Step {step} of {STEPS.length} — {STEPS[step - 1]}
                </h2>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between max-w-md mx-auto mb-8 font-sans">
              {[
                { id: 5, label: "Registration Details" },
                { id: 5, label: "Email Verification" },
                { id: 6, label: "Admin Approval" }
              ].map((s, idx) => {
                const isCompleted = 
                  (step === 5 && idx === 0) || 
                  (step === 6 && (idx === 0 || idx === 1));
                const isActive = step === s.id;
                
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
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
              ⚠️ {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-6 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 space-y-4 text-center">
              <p className="font-bold text-sm">{successMessage}</p>
              {vritanIdGenerated && (
                <div className="p-3 bg-white border border-emerald-300 rounded-xl inline-block">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Generated Vritan ID</span>
                  <span className="text-lg font-mono font-extrabold text-emerald-700">{vritanIdGenerated}</span>
                </div>
              )}
              <div className="text-xs text-slate-600 bg-white/70 p-3 rounded-xl max-w-md mx-auto leading-relaxed border">
                Your credentials will be reviewed by the Vritan Verification Team. You will receive an email once your account has been approved.
              </div>
              <div>
                <Link to="/sign-in" className="text-xs font-bold text-emerald-700 underline mt-2 inline-block">
                  Proceed to Sign In →
                </Link>
              </div>
            </div>
          )}

          {!successMessage && step <= 4 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Identity */}
              {step === 1 && (
                <div className="space-y-4">
                  {inviteToken && invitingOrgName && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-1">
                      <div className="font-extrabold text-sm">🏥 Invitation Active!</div>
                      <div className="text-xs">
                        You have been invited to join <strong>{invitingOrgName}</strong>
                        {invitingDesignation ? ` as ${invitingDesignation}` : ""}.
                        Your email address has been pre-filled and locked for security.
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Full Name *</label>
                    <input
                      type="text"
                      placeholder="Dr. Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Gender *</label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Date of Birth *</label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Mobile Number *</label>
                      <input
                        type="tel"
                        placeholder="Mobile for clinical alerts"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Official Email *</label>
                      <input
                        type="email"
                        placeholder="doctor@institution.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        readOnly={!!inviteToken}
                        disabled={!!inviteToken}
                        className={inputCls + (inviteToken ? " bg-slate-100 cursor-not-allowed" : "")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Password *</label>
                      <input
                        type="password"
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Confirm Password *</label>
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Professional Credentials */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Medical Registration ID *</label>
                      <input
                        type="text"
                        placeholder="e.g. 12345-NMC"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Registration Council *</label>
                      <input
                        type="text"
                        placeholder="e.g. National Medical Commission"
                        value={registrationCouncil}
                        onChange={(e) => setRegistrationCouncil(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Qualification *</label>
                      <input
                        type="text"
                        placeholder="e.g. MBBS, MD"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Clinical Experience (Years) *</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Years of practice"
                        value={yearsOfExperience}
                        onChange={(e) => setYearsOfExperience(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Primary Specialization *</label>
                      <input
                        type="text"
                        placeholder="e.g. Cardiology"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Secondary Specialization (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Electro-physiology"
                        value={secondarySpecialization}
                        onChange={(e) => setSecondarySpecialization(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Languages Spoken</label>
                    <input
                      type="text"
                      placeholder="e.g. English, Hindi, Telugu"
                      value={languagesSpoken}
                      onChange={(e) => setLanguagesSpoken(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Practice Info */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Practice Category</label>
                    <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)} className={selectCls}>
                      <option value="Hospital / Healthcare Organization">Hospital Affiliated</option>
                      <option value="Independent Clinic">Independent Clinic / Private Practice</option>
                      <option value="Telemedicine Only">Telemedicine Only</option>
                      <option value="Hybrid">Hybrid Practice (Hospital & Clinic)</option>
                    </select>
                  </div>

                  {(practiceType === "Hospital / Healthcare Organization" || practiceType === "Hybrid") && (
                    <div className="space-y-2">
                      <label className={labelCls}>Search Hospital Affiliation</label>
                      <input
                        type="text"
                        placeholder="Type registered hospital name to search"
                        value={hospitalSearch}
                        onChange={(e) => {
                          setHospitalSearch(e.target.value);
                          setSelectedHospital(null);
                        }}
                        className={inputCls}
                      />
                      {searchLoading && <p className="text-[10px] text-slate-400">Loading hospitals...</p>}
                      {hospitalsList.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-40 overflow-y-auto">
                          {hospitalsList.map((h, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setSelectedHospital(h);
                                setHospitalSearch(h.name);
                                setHospitalsList([]);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-bold border-b last:border-0 hover:bg-slate-200 transition-colors"
                            >
                              🏥 {h.name} — {h.vritan_id} ({h.city})
                            </button>
                          ))}
                        </div>
                      )}
                      {!selectedHospital && hospitalSearch.trim() && !searchLoading && hospitalsList.length === 0 && (
                        <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          ℹ️ Organization not found. You will be registered as <strong>"Pending Hospital Verification"</strong>.
                        </p>
                      )}
                    </div>
                  )}

                  {(practiceType === "Independent Clinic" || practiceType === "Hybrid") && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Clinic Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Apex Health Clinic"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Clinic PIN Code *</label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit PIN"
                            value={clinicPinCode}
                            onChange={(e) => setClinicPinCode(digits(e.target.value))}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {clinicState && (
                        <div className="p-3 bg-emerald-50 rounded-xl border text-xs grid grid-cols-2 gap-2">
                          <div><span className="font-bold text-slate-400">State:</span> {clinicState}</div>
                          <div><span className="font-bold text-slate-400">District:</span> {clinicDistrict}</div>
                          <div><span className="font-bold text-slate-400">Block:</span> {clinicMandal}</div>
                          <div><span className="font-bold text-slate-400">City:</span> {clinicCity}</div>
                        </div>
                      )}

                      <div>
                        <label className={labelCls}>Clinic Address *</label>
                        <input
                          type="text"
                          placeholder="Complete clinic address"
                          value={clinicAddress}
                          onChange={(e) => setClinicAddress(e.target.value)}
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Consultation Mode</label>
                        <select value={consultationModes} onChange={(e) => setConsultationModes(e.target.value)} className={selectCls}>
                          <option value="In-person">In-person Only</option>
                          <option value="Online">Online / Teleconsultation</option>
                          <option value="Both">Both (Hybrid)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Verification uploads */}
              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Medical Registration Certificate * (Mandatory)</label>
                    <input
                      type="file"
                      onChange={(e) => setLicenseFile(e.target.files[0])}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Government ID Proof * (Mandatory)</label>
                    <input
                      type="file"
                      onChange={(e) => setIdentityProofFile(e.target.files[0])}
                      className={inputCls}
                    />
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
                    {submitting ? "Submitting..." : "Complete Registration"}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Step 5: Email Verification (OTP) */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Verify Your Email Address</h2>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  We've sent a 6-digit One-Time Password (OTP) to your official email: <span className="font-bold text-slate-800">{email}</span>.
                  Please check your inbox and enter the code below.
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">6-Digit OTP Code</label>
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

          {/* Step 6: Approval Pending */}
          {step === 6 && (
            <div className="p-6 text-center space-y-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner animate-bounce">
                ⏳
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Registration Under Review</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Thank you! Your official email <span className="font-bold text-slate-800">{email}</span> has been verified.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto pt-2">
                  Your registration is currently under review by our administration. Once approved, you will receive an email notification and be able to sign in.
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

export default DoctorRegister;
