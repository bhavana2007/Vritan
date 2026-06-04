import { useState } from "react";

function DoctorDashboard() {
  const [patientId, setPatientId] = useState("");
  const [otpStepVisible, setOtpStepVisible] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  function handleContinue(e) {
    e.preventDefault();
    const trimmedId = patientId.trim();
    if (!trimmedId) {
      setStatusMessage("Please enter a Patient ID.");
      setOtpStepVisible(false);
      return;
    }
    setStatusMessage("");
    setOtpStepVisible(true);
    setOtpCode("");
  }

  function handleVerifyOtp(e) {
    e.preventDefault();
    const trimmed = otpCode.trim();
    if (!trimmed) {
      setStatusMessage("Please enter the OTP.");
      return;
    }
    setStatusMessage("OTP received. Verification can be wired to your backend next.");
  }

  return (
    <div className="med-page">
      <header className="border-b border-cyan-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MediLocker" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                MediLocker Doctor
              </p>
              <h1 className="text-xl font-semibold med-title sm:text-2xl">
                Secure patient access
              </h1>
            </div>
          </div>
          <p className="text-sm med-muted">
            Enter a Patient ID and complete OTP verification.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <section aria-labelledby="patient-id-heading" className="med-card p-6 sm:p-8">
            <h2 id="patient-id-heading" className="text-lg font-semibold med-title">
              Patient ID
            </h2>
            <p className="mt-1 text-sm med-muted">
              Enter the patient identifier to request access.
            </p>

            <form onSubmit={handleContinue} className="mt-5 flex flex-col gap-4">
              <label htmlFor="patient-id" className="sr-only">
                Patient ID
              </label>
              <input
                id="patient-id"
                type="text"
                autoComplete="off"
                placeholder="e.g. PAT-000123"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="med-input"
              />

              <button type="submit" className="med-button">
                Continue
              </button>
            </form>
          </section>

          {otpStepVisible ? (
            <section aria-labelledby="otp-heading" className="med-card p-6 sm:p-8">
              <h2 id="otp-heading" className="text-lg font-semibold med-title">
                OTP verification
              </h2>
              <p className="mt-1 text-sm med-muted">
                Enter the one-time code sent to the patient.
              </p>

              <form onSubmit={handleVerifyOtp} className="mt-5 flex flex-col gap-4">
                <label htmlFor="otp-input" className="sr-only">
                  One-time password
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit OTP"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="med-input text-center text-lg tracking-widest"
                />

                <button type="submit" className="med-button-secondary">
                  Verify OTP
                </button>
              </form>
            </section>
          ) : null}

          {statusMessage ? (
            <p role="status" className="med-alert med-alert-info text-center">
              {statusMessage}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default DoctorDashboard;
