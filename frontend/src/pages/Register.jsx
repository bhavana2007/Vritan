import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

import { API_BASE, parseFastApiDetail } from "../api";

function normalizeMobileDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function doctorPasswordChecks(password) {
  return [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One special character", valid: /[^A-Za-z0-9]/.test(password) },
  ];
}

function Register() {
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [hospital, setHospital] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  // Doctor verification fields
  const [doctorPhone, setDoctorPhone] = useState("");
  const [medicalLicenseNumber, setMedicalLicenseNumber] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [verificationDocument, setVerificationDocument] = useState(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const navigate = useNavigate();

  const passwordChecks = useMemo(
    () => doctorPasswordChecks(password),
    [password],
  );
  const doctorPasswordValid = passwordChecks.every((check) => check.valid);
  const registrationDone = Boolean(successMessage);
  const busy = submitting || sendingOtp || verifyingOtp || registrationDone;

  const resetOtp = () => {
    setOtp("");
    setOtpSent(false);
    setOtpVerified(false);
    setVerifiedMobile("");
    setOtpMessage("");
    setErrorMessage("");
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

    try {
      setSendingOtp(true);
      setErrorMessage("");
      const response = await fetch(`${API_BASE}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: digits, purpose: "register" }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setOtp("");
      setOtpSent(true);
      setOtpVerified(false);
      setVerifiedMobile("");
      setOtpMessage("OTP sent. Check the backend console during development.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const digits = validateMobile();
    if (!digits) return;

    const otpDigits = normalizeMobileDigits(otp);
    if (otpDigits.length !== 6) {
      setErrorMessage("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setVerifyingOtp(true);
      setErrorMessage("");
      const response = await fetch(`${API_BASE}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: digits,
          otp: otpDigits,
          purpose: "register",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setOtpVerified(true);
      setVerifiedMobile(digits);
      setOtpMessage("OTP verified. Continue with patient details.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "OTP verification failed.",
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const validatePatientDetails = () => {
    const digits = validateMobile();
    if (!digits) return null;
    if (!otpVerified || verifiedMobile !== digits) {
      setErrorMessage("Please verify OTP before registration.");
      return null;
    }
    if (
      !name.trim() ||
      !dateOfBirth ||
      !gender ||
      !bloodGroup ||
      !height ||
      !weight
    ) {
      setErrorMessage("Please complete all patient details.");
      return null;
    }
    return {
      role,
      name: name.trim(),
      mobile: digits,
      date_of_birth: dateOfBirth,
      gender,
      blood_group: bloodGroup,
      height: Number(height),
      weight: Number(weight),
    };
  };

  const validateDoctorDetails = () => {
    if (!name.trim() || !email.trim() || !hospital.trim() || !password) {
      setErrorMessage("Please complete all doctor details.");
      return null;
    }
    if (!doctorPasswordValid) {
      setErrorMessage("Please choose a stronger password that satisfies every rule.");
      return null;
    }
    const phoneDigits = normalizeMobileDigits(doctorPhone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setErrorMessage("Please enter a valid phone number with 10 to 15 digits.");
      return null;
    }
    if (!medicalLicenseNumber.trim()) {
      setErrorMessage("Medical license number is required.");
      return null;
    }
    const experience = Number(yearsOfExperience);
    if (isNaN(experience) || experience < 0 || experience > 60) {
      setErrorMessage("Years of experience must be between 0 and 60.");
      return null;
    }
    if (!verificationDocument) {
      setErrorMessage("Verification document is required.");
      return null;
    }
    return {
      role,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneDigits,
      hospital: hospital.trim(),
      medical_license_number: medicalLicenseNumber.trim(),
      years_of_experience: experience,
      specialization: specialization.trim() || null,
      password,
    };
  };

  const handleRegister = async () => {
    const userData =
      role === "patient" ? validatePatientDetails() : validateDoctorDetails();
    if (!userData) return;

    try {
      setSubmitting(true);
      setErrorMessage("");
      
      let response;
      let data;
      
      if (role === "doctor" && verificationDocument) {
        // For doctors, upload verification document first, then register
        const formData = new FormData();
        formData.append("file", verificationDocument);
        formData.append("name", userData.name);
        formData.append("email", userData.email);
        formData.append("phone", userData.phone);
        formData.append("hospital", userData.hospital);
        formData.append("medical_license_number", userData.medical_license_number);
        formData.append("years_of_experience", userData.years_of_experience);
        if (userData.specialization) {
          formData.append("specialization", userData.specialization);
        }
        formData.append("password", userData.password);
        
        response = await fetch(`${API_BASE}/register-doctor`, {
          method: "POST",
          body: formData,
        });
      } else {
        // For patients
        response = await fetch(`${API_BASE}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        });
      }

      data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setSuccessMessage(data.message);
      setTimeout(() => {
        navigate("/", {
          replace: true,
          state: { registrationSuccess: true },
        });
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="med-auth-page">
      <div className="w-full max-w-xl med-card p-5 sm:p-8">
        <div className="mb-6 text-center">
          <div className="med-brand">
            <img src="/logo.png" alt="MediLocker" className="med-logo" />
            <div className="text-left">
              <h1 className="med-title text-3xl">Create Account</h1>
              <p className="text-sm med-muted">Secure medical identity setup</p>
            </div>
          </div>
        </div>

        <div className="mb-5 med-segment">
          <button
            type="button"
            className={`med-segment-button ${
              role === "patient" ? "med-segment-button-active" : ""
            }`}
            disabled={busy}
            onClick={() => {
              setRole("patient");
              resetOtp();
            }}
          >
            Patient
          </button>
          <button
            type="button"
            className={`med-segment-button ${
              role === "doctor" ? "med-segment-button-active" : ""
            }`}
            disabled={busy}
            onClick={() => {
              setRole("doctor");
              resetOtp();
            }}
          >
            Doctor
          </button>
        </div>

        {role === "patient" ? (
          <div className="space-y-4">
            <input
              type="tel"
              placeholder="Mobile number"
              autoComplete="tel"
              inputMode="numeric"
              value={mobile}
              disabled={busy || otpVerified}
              onChange={(e) => {
                setMobile(e.target.value);
                resetOtp();
              }}
              className="med-input"
            />

            {!otpVerified ? (
              <>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={busy}
                  className="med-button w-full"
                >
                  {sendingOtp ? "Sending..." : "Send OTP"}
                </button>

                {otpSent ? (
                  <>
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      disabled={busy}
                      onChange={(e) =>
                        setOtp(normalizeMobileDigits(e.target.value))
                      }
                      className="med-input"
                    />

                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={busy}
                      className="med-button w-full"
                    >
                      {verifyingOtp ? "Verifying..." : "Verify and Continue"}
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Full name"
                  autoComplete="name"
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  className="med-input"
                />

                <input
                  type="date"
                  aria-label="Date of birth"
                  value={dateOfBirth}
                  disabled={busy}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="med-input"
                />

                <select
                  value={gender}
                  disabled={busy}
                  onChange={(e) => setGender(e.target.value)}
                  className="med-input"
                >
                  <option value="">Gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>

                <select
                  value={bloodGroup}
                  disabled={busy}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="med-input"
                >
                  <option value="">Blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Height (cm)"
                    inputMode="decimal"
                    min="0"
                    value={height}
                    disabled={busy}
                    onChange={(e) => setHeight(e.target.value)}
                    className="med-input"
                  />
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    inputMode="decimal"
                    min="0"
                    value={weight}
                    disabled={busy}
                    onChange={(e) => setWeight(e.target.value)}
                    className="med-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={busy}
                  className="med-button w-full"
                >
                  {submitting ? "Creating..." : "Create Patient Account"}
                </button>
              </>
            )}

            {otpMessage ? (
              <p className="med-alert med-alert-info text-center">{otpMessage}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Full name"
              autoComplete="name"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              className="med-input"
            />

            <input
              type="email"
              placeholder="Professional email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              className="med-input"
            />

            <input
              type="tel"
              placeholder="Phone number *"
              autoComplete="tel"
              inputMode="numeric"
              value={doctorPhone}
              disabled={busy}
              onChange={(e) => setDoctorPhone(e.target.value)}
              className="med-input"
            />

            <input
              type="text"
              placeholder="Hospital name"
              value={hospital}
              disabled={busy}
              onChange={(e) => setHospital(e.target.value)}
              className="med-input"
            />

            <input
              type="text"
              placeholder="Medical License Number *"
              value={medicalLicenseNumber}
              disabled={busy}
              onChange={(e) => setMedicalLicenseNumber(e.target.value)}
              className="med-input"
            />

            <input
              type="text"
              placeholder="Specialization (optional)"
              value={specialization}
              disabled={busy}
              onChange={(e) => setSpecialization(e.target.value)}
              className="med-input"
            />

            <input
              type="number"
              placeholder="Years of Experience *"
              inputMode="numeric"
              min="0"
              max="60"
              value={yearsOfExperience}
              disabled={busy}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              className="med-input"
            />

            <div>
              <label className="block text-sm med-muted mb-2">
                Verification Document * (PDF, JPG, JPEG, PNG)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                    if (!validTypes.includes(file.type)) {
                      setErrorMessage("Please upload a PDF, JPG, JPEG, or PNG file.");
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      setErrorMessage("File size must be less than 10MB.");
                      return;
                    }
                    setVerificationDocument(file);
                    setErrorMessage("");
                  }
                }}
                className="med-input"
              />
              {verificationDocument && (
                <p className="mt-1 text-sm med-muted">
                  Selected: {verificationDocument.name}
                </p>
              )}
            </div>

            <input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              className="med-input"
            />

            <div className="med-card-compact p-3 text-sm">
              {passwordChecks.map((check) => (
                <p
                  key={check.label}
                  className={check.valid ? "text-emerald-700" : "med-muted"}
                >
                  {check.valid ? "[ok]" : "[ ]"} {check.label}
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRegister}
              disabled={busy}
              className="med-button w-full"
            >
              {submitting ? "Submitting..." : "Submit for Verification"}
            </button>
          </div>
        )}

        {successMessage ? (
          <p className="mt-4 med-alert med-alert-success text-center">
            {successMessage} Redirecting...
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 med-alert med-alert-danger text-center">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-5 text-center text-sm med-muted">
          Already have an account?{" "}
          <Link to="/" className="med-link">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
[]
