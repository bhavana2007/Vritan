import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

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

function DoctorPrescriptions() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [toast, setToast] = useState(null);
  const routeMode = searchParams.get("mode");
  const effectiveViewMode = routeMode === "create" ? "create" : viewMode;

  const fetchPrescriptions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const url = `${API_BASE}/prescriptions/doctor/my-prescriptions${
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
  }, [searchQuery, statusFilter, token]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleCreateNew() {
    setSelectedPrescription(null);
    navigate("/doctor/patients");
  }

  function handleViewPrescription(prescription) {
    setSelectedPrescription(prescription);
    setViewMode("view");
  }

  function handleEditPrescription(prescription) {
    setSelectedPrescription(prescription);
    setViewMode("edit");
  }

  function handleBackToList() {
    setViewMode("list");
    setSelectedPrescription(null);
    fetchPrescriptions();
  }

  function canEdit(prescription) {
    if (!prescription.created_at) return false;
    const createdTime = new Date(prescription.created_at);
    const now = new Date();
    const diffHours = (now - createdTime) / (1000 * 60 * 60);
    return diffHours <= 1;
  }

  function canDelete(prescription) {
    if (!prescription.created_at) return false;
    const createdTime = new Date(prescription.created_at);
    const now = new Date();
    const diffHours = (now - createdTime) / (1000 * 60 * 60);
    return diffHours <= 1;
  }

  const doctorDisplayName = user?.name || user?.email || "Doctor";

  if (effectiveViewMode === "create") {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="prescriptions" />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-800">
              <h2 className="text-xl font-semibold mb-2">Create Prescription</h2>
              <p className="mb-4">Please search for a patient and request access before creating a prescription.</p>
              <button
                onClick={() => navigate("/doctor/patients")}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Go to Patients
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (effectiveViewMode === "view" && selectedPrescription) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="prescriptions" />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleBackToList}
              className="mb-4 text-teal-600 hover:text-teal-700 font-medium"
            >
              ← Back to Prescriptions
            </button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {selectedPrescription.prescription_id}
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Diagnosis</p>
                  <p className="text-lg font-semibold text-gray-900">{formatText(selectedPrescription.diagnosis)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Symptoms</p>
                  <p className="text-gray-900">{formatText(selectedPrescription.symptoms)}</p>
                </div>
                {selectedPrescription.notes ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Notes</p>
                    <p className="text-gray-900">{formatText(selectedPrescription.notes)}</p>
                  </div>
                ) : null}
                {selectedPrescription.follow_up_date ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Follow-up Date</p>
                    <p className="text-gray-900">{formatDate(selectedPrescription.follow_up_date)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-sm text-gray-600 mb-1">Created</p>
                  <p className="text-gray-900">{formatDateTime(selectedPrescription.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Medicines</p>
                  <div className="space-y-2">
                    {selectedPrescription.medicines?.map((med, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900">{med.medicine_name}</p>
                        <p className="text-sm text-gray-600">{med.dosage} - {med.frequency} - {med.duration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="prescriptions" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {toast ? (
            <div className={`mb-6 p-4 rounded-lg ${
              toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {toast.message}
            </div>
          ) : null}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Prescription Management</h1>
            <p className="mt-2 text-gray-600">View and manage your prescriptions.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-gray-900">My Prescriptions</h2>
              <button type="button" onClick={() => navigate("/doctor/patients")} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                + Create Prescription
              </button>
            </div>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                placeholder="Search by ID, diagnosis, or symptoms"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:max-w-48"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <button
                type="button"
                onClick={fetchPrescriptions}
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-400 transition-colors"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            {error ? (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
            ) : null}

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                <p className="mt-4 text-gray-600">Loading prescriptions...</p>
              </div>
            ) : null}

            {!loading && prescriptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No prescriptions found. Go to Patients to create your first prescription.
              </div>
            ) : null}

            {!loading && prescriptions.length > 0 ? (
              <div className="space-y-3">
                {prescriptions.map((prescription) => (
                  <div key={prescription.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-semibold text-gray-900">
                            {prescription.prescription_id}
                          </p>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                        <p className="mt-2 text-sm text-gray-600">
                          Diagnosis: {formatText(prescription.diagnosis)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Created: {formatDateTime(prescription.created_at)}
                        </p>
                        {prescription.follow_up_date ? (
                          <p className="mt-1 text-sm text-gray-600">
                            Follow-up: {formatDate(prescription.follow_up_date)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewPrescription(prescription)}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          View
                        </button>
                        {canEdit(prescription) ? (
                          <button
                            type="button"
                            onClick={() => handleEditPrescription(prescription)}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDelete(prescription) ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm("Are you sure you want to delete this prescription?")) {
                                try {
                                  const response = await fetch(
                                    `${API_BASE}/prescriptions/${prescription.prescription_id}`,
                                    {
                                      method: "DELETE",
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    }
                                  );
                                  if (!response.ok) {
                                    const data = await response.json().catch(() => ({}));
                                    throw new Error(parseFastApiDetail(data));
                                  }
                                  setToast({ type: "success", message: "Prescription deleted!" });
                                  fetchPrescriptions();
                                } catch (err) {
                                  setToast({ type: "danger", message: err.message });
                                }
                              }
                            }}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DoctorPrescriptions;
