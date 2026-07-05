import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import MedicalRecordCard from "../components/MedicalRecordCard";
import SecureFileViewer from "../components/SecureFileViewer";
import { useAuth } from "../hooks/useAuth";

function formatText(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return String(value);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Doctor() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [patientUid, setPatientUid] = useState("");
  const [patientResult, setPatientResult] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [recordsMessage, setRecordsMessage] = useState("");
  const [accessExpiresAt, setAccessExpiresAt] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSearchFilter, setRecordSearchFilter] = useState("all");
  const [viewingRecordId, setViewingRecordId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [hasActiveAccess, setHasActiveAccess] = useState(false);
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDoctorProfile() {
      if (!token) return;

      try {
        setProfileError("");
        const response = await fetch(`${API_BASE}/doctor/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        if (!cancelled) {
          setDoctorProfile(data);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Could not load doctor profile.",
          );
        }
      }
    }

    fetchDoctorProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isVerifiedDoctor = doctorProfile
    ? doctorProfile.is_verified === true && user?.is_verified !== false
    : user?.is_verified === true;
  const doctorDisplayName =
    doctorProfile?.full_name ||
    user?.name ||
    doctorProfile?.email ||
    user?.email ||
    "";

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  async function handlePatientSearch(e) {
    e.preventDefault();
    const uid = patientUid.trim();
    if (!uid) {
      setSearchMessage("Please enter a Patient ID.");
      setPatientResult(null);
      return;
    }

    setSearching(true);
    setSearchMessage("");
    setRequestMessage("");
    setRecordsMessage("");
    setAccessExpiresAt("");
    setHasActiveAccess(false);
    setPatientResult(null);
    setPatientRecords([]);

    try {
      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(uid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPatientResult(data);
    } catch (error) {
      setSearchMessage(
        error instanceof Error ? error.message : "Could not search patient.",
      );
    } finally {
      setSearching(false);
    }
  }

  const loadApprovedRecords = useCallback(async (uid = patientResult?.patient_uid) => {
    if (!uid) return;
    setLoadingRecords(true);
    setRecordsMessage("");

    try {
      const params = new URLSearchParams();
      if (recordSearch.trim()) {
        params.set("q", recordSearch.trim());
      }
      params.set("filter", recordSearchFilter);
      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(uid)}/records${
          params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPatientRecords(Array.isArray(data) ? data : []);
      setHasActiveAccess(true);
      setRecordsMessage("Temporary record access is active.");
    } catch (error) {
      setPatientRecords([]);
      setHasActiveAccess(false);
      setRecordsMessage(
        error instanceof Error
          ? error.message
          : "Waiting for patient approval.",
      );
    } finally {
      setLoadingRecords(false);
    }
  }, [patientResult?.patient_uid, recordSearch, recordSearchFilter, token]);

  const checkAccessStatus = useCallback(async (uid = patientResult?.patient_uid) => {
    if (!uid) return;
    try {
      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(uid)}/access-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setAccessExpiresAt(data.expires_at || "");
      setRequestMessage(data.message || "");
      if (data.status === "approved") {
        setHasActiveAccess(true);
        await loadApprovedRecords(uid);
      }
      if (data.status === "expired" || data.status === "denied") {
        setHasActiveAccess(false);
        setPatientRecords([]);
      }
    } catch {
      // Polling should stay quiet; direct actions surface errors.
    }
  }, [loadApprovedRecords, patientResult?.patient_uid, token]);

  useEffect(() => {
    if (!patientResult?.patient_uid) return undefined;
    const timer = window.setInterval(() => {
      checkAccessStatus(patientResult.patient_uid);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [checkAccessStatus, patientResult?.patient_uid]);

  async function handleViewRecord(record) {
    setViewingRecordId(record.id);
    setRecordsMessage("");

    try {
      const response = await fetch(`${API_BASE}${record.file_url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.blob();
      if (!response.ok) {
        const payload = await data.text().then(JSON.parse).catch(() => ({}));
        throw new Error(parseFastApiDetail(payload));
      }
      const objectUrl = window.URL.createObjectURL(data);
      setViewerFile({
        url: objectUrl,
        filename: record.original_filename,
        mimeType: data.type || "",
      });
    } catch (error) {
      setRecordsMessage(
        error instanceof Error ? error.message : "Could not open this file.",
      );
    } finally {
      setViewingRecordId(null);
    }
  }

  function closeViewer() {
    if (viewerFile?.url) {
      window.URL.revokeObjectURL(viewerFile.url);
    }
    setViewerFile(null);
  }

  async function handleRequestAccess() {
    if (!patientResult?.patient_uid) return;
    setRequesting(true);
    setRequestMessage("");
    setRecordsMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/doctor/request-access/${encodeURIComponent(
          patientResult.patient_uid,
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setAccessExpiresAt(data.expires_at || "");
      setRequestMessage(data.message || "Waiting for patient approval.");
      if (data.status === "approved") {
        await loadApprovedRecords(patientResult.patient_uid);
      }
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : "Could not create access request.",
      );
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="med-page">
      <SecureFileViewer file={viewerFile} onClose={closeViewer} />
      <div className="med-shell max-w-3xl">
        <div className="med-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="MediLocker" className="h-11 w-11 object-contain" />
            <p className="truncate text-sm med-muted">Doctor - {doctorDisplayName}</p>
          </div>
          <button type="button" onClick={handleLogout} className="med-button-secondary">
            Log out
          </button>
        </div>

        <h1 className="mb-6 text-center text-3xl med-title sm:text-4xl">
          Doctor Dashboard
        </h1>

        <section className="mb-8 med-card p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/doctor/prescriptions")}
              className="med-button"
            >
              Prescription Management
            </button>
          </div>
        </section>

        {profileError ? (
          <div className="mb-8 med-alert med-alert-danger text-center">
            {profileError}
          </div>
        ) : null}

        {doctorProfile?.verification_status === "approved" && !user?.is_verified ? (
          <div className="mb-8 med-alert med-alert-success text-center">
            Your account has been verified. Please log in again.
          </div>
        ) : null}

        {!isVerifiedDoctor ? (
          <div className="mb-8 med-card p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-2xl text-teal-700">
              +
            </div>
            <p className="text-xl font-semibold med-title">
              {doctorProfile?.verification_status === "rejected"
                ? "Verification rejected"
                : "Verification pending"}
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm med-muted">
              {doctorProfile?.verification_status === "rejected"
                ? "Your verification request was rejected. Please contact support."
                : "Your registration is being reviewed. Patient search, access requests, and medical records are disabled until an administrator verifies your account."}
            </p>
            {doctorProfile?.verification_status !== "rejected" ? (
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold text-teal-700">
                Once your account is verified by the administrator, please log in
                again to access patient workflows and medical records.
              </p>
            ) : null}
          </div>
        ) : null}

        {isVerifiedDoctor ? (
          <>
            <section className="mb-8 med-card p-5 sm:p-6">
              <h2 className="mb-1 text-2xl font-semibold med-title">
                Search Patient by Patient ID
              </h2>
              <p className="mb-4 text-sm med-muted">
                Patient records stay private until the patient approves access.
              </p>

              <form
                onSubmit={handlePatientSearch}
                className="flex flex-col gap-4 sm:flex-row"
              >
                <input
                  type="text"
                  placeholder="Enter Patient ID"
                  value={patientUid}
                  onChange={(e) => setPatientUid(e.target.value)}
                  className="med-input flex-1"
                />

                <button type="submit" disabled={searching} className="med-button">
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              {searchMessage ? (
                <p className="mt-4 med-alert med-alert-info">{searchMessage}</p>
              ) : null}
            </section>

            {patientResult ? (
              <section className="mb-8 med-card p-5 sm:p-6">
                <h2 className="mb-4 text-2xl font-semibold med-title">
                  Patient Summary
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="med-detail-card">
                    <p className="med-detail-label">Name</p>
                    <p className="med-detail-value">
                      {formatText(patientResult.full_name)}
                    </p>
                  </div>
                  <div className="med-detail-card">
                    <p className="med-detail-label">Patient ID</p>
                    <p className="med-detail-value">
                      {formatText(patientResult.patient_uid)}
                    </p>
                  </div>
                  <div className="med-detail-card">
                    <p className="med-detail-label">Blood Group</p>
                    <p className="med-detail-value">
                      {formatText(patientResult.blood_group)}
                    </p>
                  </div>
                  <div className="med-detail-card">
                    <p className="med-detail-label">Gender</p>
                    <p className="med-detail-value">
                      {formatText(patientResult.gender)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleRequestAccess}
                    disabled={requesting}
                    className="med-button"
                  >
                    {requesting ? "Requesting..." : "Request Access"}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadApprovedRecords()}
                    disabled={loadingRecords}
                    className="med-button-secondary"
                  >
                    {loadingRecords ? "Checking..." : "Check Approval"}
                  </button>
                </div>

                {requestMessage ? (
                  <p className="mt-4 med-alert med-alert-info">
                    {requestMessage}
                    {accessExpiresAt ? (
                      <span> Expires: {formatDateTime(accessExpiresAt)}</span>
                    ) : null}
                  </p>
                ) : null}

                {recordsMessage ? (
                  <p className="mt-4 med-alert med-alert-info">{recordsMessage}</p>
                ) : null}
              </section>
            ) : null}

            {hasActiveAccess ? (
              <section className="med-card p-5 sm:p-6">
                <h2 className="mb-4 text-2xl font-semibold med-title">
                  Approved Medical Records
                </h2>
                <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="search"
                    placeholder="Search medicines, conditions, notes, or OCR text"
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    className="med-input flex-1"
                  />
                  <select
                    value={recordSearchFilter}
                    onChange={(e) => setRecordSearchFilter(e.target.value)}
                    className="med-input sm:max-w-48"
                  >
                    <option value="all">All tags</option>
                    <option value="medicine">Medicine</option>
                    <option value="condition">Condition</option>
                    <option value="ocr">OCR text</option>
                    <option value="month">Upload month</option>
                    <option value="type">Record type</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => loadApprovedRecords()}
                    disabled={loadingRecords}
                    className="med-button-secondary"
                  >
                    Search
                  </button>
                </div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {["fever", "Augmentin", "report", "May 2026"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRecordSearch(chip)}
                      className="med-chip"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {patientRecords.length === 0 ? (
                  <div className="med-alert med-alert-info">
                    No records match the current search.
                  </div>
                ) : null}
                <div className="space-y-3">
                  {patientRecords.map((record) => (
                    <MedicalRecordCard
                      key={record.id}
                      record={record}
                      searchQuery={recordSearch}
                      onView={handleViewRecord}
                      viewing={viewingRecordId === record.id}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="text-center text-sm med-muted">
                Medical records appear here only after patient approval.
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-sm med-muted">
            This space will unlock patient workflows after verification.
          </div>
        )}
      </div>
    </div>
  );
}

export default Doctor;
