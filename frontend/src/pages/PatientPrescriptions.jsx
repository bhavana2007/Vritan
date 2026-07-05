import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function formatText(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  return String(value);
}

function PatientPrescriptions() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list, view
  const [toast, setToast] = useState(null);

  const fetchPrescriptions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const url = `${API_BASE}/prescriptions/patient/my-prescriptions${
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
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prescriptions.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, token]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPrescriptions();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchPrescriptions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  function handleViewPrescription(prescription) {
    setSelectedPrescription(prescription);
    setViewMode("view");
  }

  function handleBackToList() {
    setViewMode("list");
    setSelectedPrescription(null);
    fetchPrescriptions();
  }

  const patientDisplayName = user?.name || user?.mobile || "Patient";

  if (viewMode === "view" && selectedPrescription) {
    return (
      <PrescriptionView
        prescription={selectedPrescription}
        token={token}
        onBack={handleBackToList}
      />
    );
  }

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

      <div className="med-shell max-w-4xl">
        <div className="med-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="MediLocker" className="h-11 w-11 object-contain" />
            <p className="truncate text-sm med-muted">Patient - {patientDisplayName}</p>
          </div>
          <button type="button" onClick={handleLogout} className="med-button-secondary">
            Log out
          </button>
        </div>

        <h1 className="mb-6 text-center text-3xl med-title sm:text-4xl">
          My Prescriptions
        </h1>

        <section className="mb-8 med-card p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold med-title">Prescription History</h2>
            <p className="mt-1 text-sm med-muted">
              View all prescriptions from your doctors. Prescriptions appear here automatically after creation.
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              placeholder="Search by ID, diagnosis, or doctor name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="med-input flex-1"
            />
            <button
              type="button"
              onClick={fetchPrescriptions}
              disabled={loading}
              className="med-button-secondary"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {error ? (
            <div className="mb-4 med-alert med-alert-danger">{error}</div>
          ) : null}

          {loading ? (
            <div className="med-alert med-alert-info">Loading prescriptions...</div>
          ) : null}

          {!loading && prescriptions.length === 0 ? (
            <div className="med-alert med-alert-info">
              No prescriptions found yet. Your prescriptions will appear here after your doctors create them.
            </div>
          ) : null}

          {!loading && prescriptions.length > 0 ? (
            <div className="space-y-3">
              {prescriptions.map((prescription) => (
                <div key={prescription.id} className="med-detail-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold med-title">
                          {prescription.prescription_id}
                        </p>
                        <span
                          className={`med-chip ${
                            prescription.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : prescription.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {prescription.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm med-muted">
                        Doctor: {prescription.doctor_name}
                      </p>
                      <p className="mt-1 text-sm med-muted">
                        Diagnosis: {formatText(prescription.diagnosis)}
                      </p>
                      <p className="mt-1 text-sm med-muted">
                        Created: {formatDateTime(prescription.created_at)}
                      </p>
                      {prescription.follow_up_date ? (
                        <p className="mt-1 text-sm med-muted">
                          Follow-up: {formatDate(prescription.follow_up_date)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewPrescription(prescription)}
                        className="med-button-secondary text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function PrescriptionView({ prescription, token, onBack }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/prescriptions/${prescription.prescription_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        setDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load prescription details");
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [prescription.prescription_id, token]);

  function handlePrint() {
    window.print();
  }

  function handleDownloadPDF() {
    // For now, just trigger print - in production you'd use a PDF library
    window.print();
  }

  if (loading) {
    return (
      <div className="med-page">
        <div className="med-shell max-w-4xl">
          <div className="med-alert med-alert-info">Loading prescription details...</div>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="med-page">
        <div className="med-shell max-w-4xl">
          <div className="med-alert med-alert-danger">{error || "Could not load prescription"}</div>
          <button type="button" onClick={onBack} className="mt-4 med-button">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="med-page">
      <div className="med-shell max-w-4xl">
        <div className="med-topbar">
          <h2 className="text-xl font-semibold med-title">Prescription Details</h2>
          <div className="flex gap-2">
            <button type="button" onClick={handlePrint} className="med-button-secondary text-sm">
              Print
            </button>
            <button type="button" onClick={handleDownloadPDF} className="med-button-secondary text-sm">
              Download PDF
            </button>
            <button type="button" onClick={onBack} className="med-button-secondary text-sm">
              Back
            </button>
          </div>
        </div>

        <div className="prescription-print-container">
          <div className="med-card p-6 sm:p-8">
            <div className="mb-6 border-b border-cyan-100 pb-6">
              <h1 className="text-2xl font-bold med-title">{details.doctor_hospital}</h1>
              <p className="mt-1 text-sm med-muted">{details.doctor_specialization || "Doctor"}</p>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Doctor</p>
                <p className="font-semibold med-title">{details.doctor_name}</p>
                <p className="text-sm med-muted">{details.doctor_phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Prescription ID</p>
                <p className="font-semibold med-title">{details.prescription_id}</p>
                <p className="text-sm med-muted">{formatDateTime(details.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Patient</p>
                <p className="font-semibold med-title">{details.patient_name}</p>
                <p className="text-sm med-muted">{details.patient_uid}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Follow-up</p>
                <p className="font-semibold med-title">{formatDate(details.follow_up_date)}</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Symptoms</p>
              <p className="med-detail-value">{formatText(details.symptoms)}</p>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Diagnosis</p>
              <p className="med-detail-value">{formatText(details.diagnosis)}</p>
            </div>

            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold uppercase text-gray-500">Medicines</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-cyan-100">
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Medicine</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Dosage</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Frequency</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Duration</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Food</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold med-title">Instructions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.medicines.map((med, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-sm">{med.medicine_name}</td>
                        <td className="px-3 py-2 text-sm">{med.dosage}</td>
                        <td className="px-3 py-2 text-sm">{med.frequency}</td>
                        <td className="px-3 py-2 text-sm">{med.duration}</td>
                        <td className="px-3 py-2 text-sm">{med.food_instruction}</td>
                        <td className="px-3 py-2 text-sm">{med.special_instruction || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {details.notes ? (
              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Additional Notes</p>
                <p className="med-detail-value">{formatText(details.notes)}</p>
              </div>
            ) : null}

            <div className="mt-8 border-t border-cyan-100 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Doctor's Signature</p>
                  {details.doctor_signature_url ? (
                    <img src={details.doctor_signature_url} alt="Signature" className="mt-2 h-16 w-auto" />
                  ) : (
                    <p className="mt-2 text-sm italic text-gray-400">Signature not available</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
                  <span
                    className={`med-chip ${
                      details.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : details.status === "CANCELLED"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {details.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button type="button" onClick={onBack} className="med-button w-full">
            Back to List
          </button>
        </div>
      </div>
    </div>
  );
}

export default PatientPrescriptions;
