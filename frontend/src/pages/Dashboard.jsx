import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import MedicalRecordCard from "../components/MedicalRecordCard";
import SecureFileViewer from "../components/SecureFileViewer";
import { useAuth } from "../hooks/useAuth";

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not provided";
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

function formatText(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return String(value);
}

function formatMeasurement(value, unit) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return `${value} ${unit}`;
}

function DetailItem({ label, value }) {
  return (
    <div className="med-detail-card">
      <p className="med-detail-label">{label}</p>
      <p className="med-detail-value">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [requestsError, setRequestsError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [consentMessage, setConsentMessage] = useState("");
  const [recordType, setRecordType] = useState("prescription");
  const [recordFile, setRecordFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSearchFilter, setRecordSearchFilter] = useState("all");
  const [viewingRecordId, setViewingRecordId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchAccessRequests = useCallback(async () => {
    if (!token) {
      setRequestsLoading(false);
      return;
    }

    try {
      setRequestsLoading(true);
      setRequestsError("");
      const response = await fetch(`${API_BASE}/patient/access-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setAccessRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setRequestsError(
        error instanceof Error
          ? error.message
          : "Could not load access requests.",
      );
    } finally {
      setRequestsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPatientProfile() {
      if (!token) {
        setLoading(false);
        setErrorMessage("Please log in again to view your patient profile.");
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`${API_BASE}/patient/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }

        if (!cancelled) {
          setProfile(data);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load patient profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPatientProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const fetchRecords = useCallback(async () => {
    if (!token) {
      setRecordsLoading(false);
      return;
    }

    try {
      setRecordsLoading(true);
      setRecordsError("");
      const params = new URLSearchParams();
      if (recordSearch.trim()) {
        params.set("q", recordSearch.trim());
      }
      params.set("filter", recordSearchFilter);
      const url = `${API_BASE}/records/my-records${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setRecordsError(
        error instanceof Error
          ? error.message
          : "Could not load medical records.",
      );
    } finally {
      setRecordsLoading(false);
    }
  }, [recordSearch, recordSearchFilter, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchRecords();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchRecords]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchAccessRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAccessRequests]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchAccessRequests();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [fetchAccessRequests]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  function handleFileSelection(file) {
    setUploadMessage("");
    setRecordsError("");

    if (!file) {
      setRecordFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setRecordsError("File size should be less than 10MB.");
      setToast({
        type: "danger",
        message: "File size should be less than 10MB.",
      });
      setRecordFile(null);
      return;
    }

    setRecordFile(file);
  }

  async function handleRecordUpload(e) {
    e.preventDefault();
    if (!recordFile) {
      setRecordsError("Choose an image or PDF before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("record_type", recordType);
    formData.append("notes", notes);
    formData.append("file", recordFile);

    setUploading(true);
    setRecordsError("");
    setUploadMessage("");

    try {
      const response = await fetch(`${API_BASE}/records/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setRecords((current) => [data, ...current]);
      setRecordFile(null);
      setNotes("");
      setUploadMessage("Medical record uploaded successfully with OCR analysis.");
      setToast({
        type: "success",
        message: "Medical record uploaded successfully with OCR analysis.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not upload medical record.";
      setRecordsError(message);
      setToast({ type: "danger", message });
    } finally {
      setUploading(false);
    }
  }

  async function handleViewRecord(record) {
    setViewingRecordId(record.id);
    setRecordsError("");

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
      setRecordsError(
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

  async function confirmDeleteRecord() {
    if (!deleteCandidate) return;
    setDeletingRecordId(deleteCandidate.id);
    setRecordsError("");

    try {
      const response = await fetch(`${API_BASE}/records/${deleteCandidate.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setRecords((current) =>
        current.filter((record) => record.id !== deleteCandidate.id),
      );
      setDeleteCandidate(null);
      setToast({
        type: "success",
        message: "Medical record deleted permanently.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not delete this medical record.";
      setRecordsError(message);
      setToast({ type: "danger", message });
    } finally {
      setDeletingRecordId(null);
    }
  }

  async function handleConsentDecision(requestId, decision) {
    setRespondingRequestId(requestId);
    setRequestsError("");
    setConsentMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/patient/access-requests/${requestId}/${decision}`,
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
      setAccessRequests((current) =>
        current.map((request) => (request.id === requestId ? data : request)),
      );
      setConsentMessage(
        decision === "approve"
          ? "Access approved for 10 minutes."
          : "Access request denied.",
      );
    } catch (error) {
      setRequestsError(
        error instanceof Error
          ? error.message
          : "Could not update access request.",
      );
    } finally {
      setRespondingRequestId(null);
    }
  }

  const signedInAs =
    profile?.full_name ||
    user?.name ||
    profile?.mobile ||
    user?.mobile ||
    "Patient";

  const pendingRequests = accessRequests.filter(
    (request) => request.status === "pending",
  );

  const groupedRecords = records.reduce((groups, record) => {
    const date = new Date(record.uploaded_at);
    const label = Number.isNaN(date.getTime())
      ? "Undated"
      : date.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(record);
    return groups;
  }, {});

  return (
    <div className="med-page">
      {toast ? (
        <div
          className={`med-toast med-alert ${
            toast.type === "success" ? "med-alert-success" : "med-alert-danger"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {deleteCandidate ? (
        <div className="med-modal-backdrop" role="dialog" aria-modal="true">
          <div className="med-confirm-modal">
            <h2 className="text-xl font-semibold med-title">Delete Record</h2>
            <p className="mt-3 med-muted">
              Are you sure you want to permanently delete this medical record?
              The file, OCR text, and Gemini metadata will be removed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                disabled={deletingRecordId === deleteCandidate.id}
                className="med-button-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                disabled={deletingRecordId === deleteCandidate.id}
                className="med-button-danger"
              >
                {deletingRecordId === deleteCandidate.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SecureFileViewer file={viewerFile} onClose={closeViewer} />

      <div className="med-shell max-w-3xl">
        <div className="med-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="MediLocker" className="h-11 w-11 object-contain" />
            <p className="truncate text-sm med-muted">Patient - {signedInAs}</p>
          </div>
          <button type="button" onClick={handleLogout} className="med-button-secondary">
            Log out
          </button>
        </div>

        <main>
          <h1 className="mb-6 text-center text-3xl med-title sm:text-4xl">
            Patient Dashboard
          </h1>

          <section className="mb-8 med-card p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard/prescriptions")}
                className="med-button"
              >
                View My Prescriptions
              </button>
            </div>
          </section>

          <section className="mb-8 med-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold med-title">Patient Details</h2>
              <p className="mt-1 text-sm med-muted">
                Your identity and medical profile are protected by your login.
              </p>
            </div>

            {loading ? (
              <div className="med-alert med-alert-info">Loading patient profile...</div>
            ) : null}

            {!loading && errorMessage ? (
              <div className="med-alert med-alert-danger">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="mt-4 med-button"
                >
                  Go to Login
                </button>
              </div>
            ) : null}

            {!loading && !errorMessage && profile ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Full Name" value={formatText(profile.full_name)} />
                <DetailItem label="Patient ID" value={formatText(profile.patient_uid)} />
                <DetailItem label="Mobile" value={formatText(profile.mobile)} />
                <DetailItem
                  label="Date of Birth"
                  value={formatDate(profile.date_of_birth)}
                />
                <DetailItem label="Gender" value={formatText(profile.gender)} />
                <DetailItem
                  label="Blood Group"
                  value={formatText(profile.blood_group)}
                />
                <DetailItem label="Height" value={formatMeasurement(profile.height, "cm")} />
                <DetailItem label="Weight" value={formatMeasurement(profile.weight, "kg")} />
              </div>
            ) : null}
          </section>

          <section className="mb-8 med-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold med-title">Access Requests</h2>
              <p className="mt-1 text-sm med-muted">
                You control which verified doctors can temporarily view your records.
              </p>
            </div>

            {requestsLoading ? (
              <div className="med-alert med-alert-info">Loading access requests...</div>
            ) : null}

            {requestsError ? (
              <p className="mb-4 med-alert med-alert-danger">{requestsError}</p>
            ) : null}

            {consentMessage ? (
              <p className="mb-4 med-alert med-alert-success">{consentMessage}</p>
            ) : null}

            {!requestsLoading && pendingRequests.length === 0 ? (
              <div className="med-alert med-alert-info">
                No pending doctor access requests.
              </div>
            ) : null}

            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="med-detail-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold med-title">
                        {request.doctor_name || "Verified doctor"}
                      </p>
                      <p className="text-sm med-muted">
                        {request.hospital || "Hospital not provided"}
                      </p>
                      <p className="mt-2 text-sm med-muted">
                        Requested: {formatDateTime(request.created_at)}
                      </p>
                      <p className="mt-1 text-sm text-teal-700">
                        Approval grants temporary access for 10 minutes.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                      <button
                        type="button"
                        disabled={respondingRequestId === request.id}
                        onClick={() => handleConsentDecision(request.id, "approve")}
                        className="med-button-success"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={respondingRequestId === request.id}
                        onClick={() => handleConsentDecision(request.id, "deny")}
                        className="med-button-danger"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="med-card p-5 sm:p-6">
            <h2 className="mb-1 text-2xl font-semibold med-title">Medical Records</h2>
            <p className="mb-4 text-sm med-muted">
              Upload prescriptions, reports, scans, and other documents.
            </p>

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
                onClick={fetchRecords}
                disabled={recordsLoading}
                className="med-button-secondary"
              >
                Search
              </button>
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {["fever", "prescription", "blood report", "May 2026"].map((chip) => (
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

            <form onSubmit={handleRecordUpload} className="mb-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <select
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                  disabled={uploading}
                  className="med-input"
                >
                  <option value="prescription">Prescription</option>
                  <option value="report">Report</option>
                  <option value="scan">Scan</option>
                  <option value="other">Other</option>
                </select>

                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={uploading}
                  className="med-input"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="med-file-button">
                  Upload Image/PDF
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileSelection(e.target.files?.[0])}
                    disabled={uploading}
                    className="sr-only"
                  />
                </label>

                <label className="med-file-button">
                  Camera Capture
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    onChange={(e) => handleFileSelection(e.target.files?.[0])}
                    disabled={uploading}
                    className="sr-only"
                  />
                </label>
              </div>

              {recordFile ? (
                <p className="med-alert med-alert-info">
                  Selected file: {recordFile.name}
                </p>
              ) : null}

              <button type="submit" disabled={uploading} className="med-button w-full">
                {uploading ? "Uploading..." : "Save Medical Record"}
              </button>
            </form>

            {uploadMessage ? (
              <p className="mb-4 med-alert med-alert-success">{uploadMessage}</p>
            ) : null}

            {recordsError ? (
              <div className="mb-4 med-alert med-alert-danger">
                <p>{recordsError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setRecordsError("");
                    setRecordFile(null);
                  }}
                  className="mt-3 med-button-secondary"
                >
                  Retry upload
                </button>
              </div>
            ) : null}

            {recordsLoading ? (
              <div className="med-alert med-alert-info">Loading medical records...</div>
            ) : null}

            {!recordsLoading && records.length === 0 ? (
              <div className="med-alert med-alert-info">
                No medical records uploaded yet.
              </div>
            ) : null}

            {!recordsLoading && records.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedRecords).map(([monthLabel, monthRecords]) => (
                  <div key={monthLabel} className="med-timeline-group">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold med-title">{monthLabel}</h3>
                      <span className="med-chip">{monthRecords.length} records</span>
                    </div>
                    <div className="space-y-3">
                      {monthRecords.map((record) => (
                        <MedicalRecordCard
                          key={record.id}
                          record={record}
                          searchQuery={recordSearch}
                          onView={handleViewRecord}
                          onDelete={setDeleteCandidate}
                          viewing={viewingRecordId === record.id}
                          deleting={deletingRecordId === record.id}
                          showDelete
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
