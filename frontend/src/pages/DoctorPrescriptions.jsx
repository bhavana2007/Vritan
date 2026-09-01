import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

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

const emptyMedicine = () => ({
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  food_instruction: "",
  special_instruction: "",
});

function DoctorPrescriptions() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list, create, view, edit
  const [toast, setToast] = useState(null);
  const [showSignatureUpload, setShowSignatureUpload] = useState(false);
  const [signatureFile, setSignatureFile] = useState(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");
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

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  function handleCreateNew() {
    setSelectedPrescription(null);
    navigate("/doctor/prescriptions?mode=create", {
      state: { fromPrescriptionsList: true },
    });
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
    if (effectiveViewMode === "create" && location.state?.fromPrescriptionsList) {
      navigate(-1);
      return;
    }
    if (effectiveViewMode === "create") {
      navigate("/doctor/prescriptions", { replace: true });
      return;
    }
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

  async function handleSignatureUpload(e) {
    e.preventDefault();
    if (!signatureFile) {
      setSignatureMessage("Please select a signature image");
      return;
    }

    setUploadingSignature(true);
    setSignatureMessage("");

    try {
      const formData = new FormData();
      formData.append("file", signatureFile);

      const response = await fetch(`${API_BASE}/prescriptions/doctor/upload-signature`, {
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
      setSignatureMessage("Signature uploaded successfully!");
      setSignatureFile(null);
      setTimeout(() => {
        setShowSignatureUpload(false);
        setSignatureMessage("");
      }, 2000);
    } catch (err) {
      setSignatureMessage(err instanceof Error ? err.message : "Could not upload signature");
    } finally {
      setUploadingSignature(false);
    }
  }

  if (effectiveViewMode === "create") {
    return (
      <CreatePrescriptionForm
        token={token}
        onCancel={handleBackToList}
        onSuccess={() => {
          setToast({ type: "success", message: "Prescription created successfully!" });
          navigate("/doctor/prescriptions", { replace: true });
          setViewMode("list");
          fetchPrescriptions();
        }}
      />
    );
  }

  if (effectiveViewMode === "view" && selectedPrescription) {
    return (
      <PrescriptionView
        prescription={selectedPrescription}
        token={token}
        onBack={handleBackToList}
        onEdit={canEdit(selectedPrescription) ? handleEditPrescription : null}
        canDelete={canDelete(selectedPrescription)}
        onDelete={async () => {
          if (window.confirm("Are you sure you want to delete this prescription?")) {
            try {
              const response = await fetch(
                `${API_BASE}/prescriptions/${selectedPrescription.prescription_id}`,
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
              setToast({ type: "success", message: "Prescription deleted successfully!" });
              handleBackToList();
            } catch (err) {
              setToast({ type: "danger", message: err.message });
            }
          }
        }}
      />
    );
  }

  if (effectiveViewMode === "edit" && selectedPrescription) {
    return (
      <EditPrescriptionForm
        prescription={selectedPrescription}
        token={token}
        onCancel={handleBackToList}
        onSuccess={() => {
          setToast({ type: "success", message: "Prescription updated successfully!" });
          handleBackToList();
        }}
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
            <img src="/logo.png" alt="Vritan" className="h-11 w-11 object-contain" />
            <p className="truncate text-sm med-muted">Doctor - {doctorDisplayName}</p>
          </div>
          <button type="button" onClick={handleLogout} className="med-button-secondary">
            Log out
          </button>
        </div>

        <h1 className="mb-6 text-center text-3xl med-title sm:text-4xl">
          Prescription Management
        </h1>

        <section className="mb-8 med-card p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold med-title">My Prescriptions</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSignatureUpload(true)}
                className="med-button-secondary text-sm"
              >
                Upload Signature
              </button>
              <button type="button" onClick={handleCreateNew} className="med-button">
                + Create Prescription
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              placeholder="Search by ID, diagnosis, or symptoms"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="med-input flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="med-input sm:max-w-48"
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
              No prescriptions found. Create your first prescription to get started.
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
                        View
                      </button>
                      {canEdit(prescription) ? (
                        <button
                          type="button"
                          onClick={() => handleEditPrescription(prescription)}
                          className="med-button-secondary text-sm"
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
                          className="med-button-danger text-sm"
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
        </section>

        {showSignatureUpload ? (
          <div className="med-modal-backdrop" role="dialog" aria-modal="true">
            <div className="med-confirm-modal">
              <h2 className="text-xl font-semibold med-title">Upload Signature</h2>
              <p className="mt-3 med-muted">
                Upload your signature image. This will appear on all your prescriptions.
              </p>
              <form onSubmit={handleSignatureUpload} className="mt-5 space-y-4">
                <label className="med-file-button">
                  Select Signature Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSignatureFile(e.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
                {signatureFile ? (
                  <p className="med-alert med-alert-info">
                    Selected: {signatureFile.name}
                  </p>
                ) : null}
                {signatureMessage ? (
                  <p className={`med-alert ${signatureMessage.includes("success") ? "med-alert-success" : "med-alert-danger"}`}>
                    {signatureMessage}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignatureUpload(false);
                      setSignatureFile(null);
                      setSignatureMessage("");
                    }}
                    disabled={uploadingSignature}
                    className="med-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingSignature}
                    className="med-button"
                  >
                    {uploadingSignature ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CreatePrescriptionForm({ token, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientSearchResult, setPatientSearchResult] = useState(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [medicineSuggestions, setMedicineSuggestions] = useState({});
  const suggestionCacheRef = useRef(new Map());
  const suggestionTimersRef = useRef({});

  async function handlePatientSearch(e) {
    e.preventDefault();
    if (!patientId.trim()) {
      setError("Please enter a Patient ID");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientId.trim())}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPatientSearchResult(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Patient not found");
      setPatientSearchResult(null);
    }
  }

  function addMedicine() {
    setMedicines([...medicines, emptyMedicine()]);
  }

  function removeMedicine(index) {
    if (medicines.length > 1) {
      setMedicines(medicines.filter((_, i) => i !== index));
    }
  }

  function updateMedicine(index, field, value) {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine,
      ),
    );
    if (field === "medicine_name") {
      scheduleMedicineSuggestions(index, value);
    }
  }

  function scheduleMedicineSuggestions(index, value) {
    const query = value.trim();
    window.clearTimeout(suggestionTimersRef.current[index]);
    if (query.length < 2) {
      setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
      return;
    }
    const cacheKey = query.toLowerCase();
    if (suggestionCacheRef.current.has(cacheKey)) {
      setMedicineSuggestions((current) => ({
        ...current,
        [index]: suggestionCacheRef.current.get(cacheKey),
      }));
      return;
    }
    suggestionTimersRef.current[index] = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/prescriptions/medicines/search?q=${encodeURIComponent(query)}&limit=8`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          return;
        }
        const results = Array.isArray(data) ? data : [];
        suggestionCacheRef.current.set(cacheKey, results);
        setMedicineSuggestions((current) => ({ ...current, [index]: results }));
      } catch {
        setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
      }
    }, 220);
  }

  function applyMedicineSuggestion(index, suggestion) {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index
          ? {
              ...medicine,
              medicine_name: suggestion.brand_name || suggestion.name,
              dosage: medicine.dosage || suggestion.strength || "",
            }
          : medicine,
      ),
    );
    setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!patientSearchResult) {
      setError("Please search and select a patient first");
      return;
    }
    if (!diagnosis.trim() || !symptoms.trim()) {
      setError("Diagnosis and symptoms are required");
      return;
    }
    if (medicines.some((med) => !med.medicine_name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim() || !med.food_instruction.trim())) {
      setError("All medicine fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/prescriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: patientSearchResult.id,
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim(),
          notes: notes.trim() || null,
          follow_up_date: followUpDate || null,
          medicines: medicines.map((med) => ({
            medicine_name: med.medicine_name.trim(),
            dosage: med.dosage.trim(),
            frequency: med.frequency.trim(),
            duration: med.duration.trim(),
            food_instruction: med.food_instruction.trim(),
            special_instruction: med.special_instruction.trim() || null,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create prescription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="med-page">
      <div className="med-shell max-w-4xl">
        <div className="med-topbar">
          <h2 className="text-xl font-semibold med-title">Create New Prescription</h2>
          <button type="button" onClick={onCancel} className="med-button-secondary">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="med-card p-5 sm:p-6">
            <h3 className="mb-4 text-xl font-semibold med-title">Patient Selection</h3>
            <div className="mb-4 flex gap-3">
              <input
                type="text"
                placeholder="Enter Patient ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="med-input flex-1"
              />
              <button type="button" onClick={handlePatientSearch} className="med-button">
                Search
              </button>
            </div>
            {error && !patientSearchResult ? (
              <div className="med-alert med-alert-danger">{error}</div>
            ) : null}
            {patientSearchResult ? (
              <div className="med-detail-card">
                <p className="font-semibold med-title">{patientSearchResult.full_name}</p>
                <p className="text-sm med-muted">Patient ID: {patientSearchResult.patient_uid}</p>
                <p className="text-sm med-muted">Blood Group: {patientSearchResult.blood_group || "Not provided"}</p>
              </div>
            ) : null}
          </section>

          <section className="med-card p-5 sm:p-6">
            <h3 className="mb-4 text-xl font-semibold med-title">Diagnosis & Symptoms</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Diagnosis *</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="med-input min-h-[100px]"
                  placeholder="Enter diagnosis"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Symptoms *</label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="med-input min-h-[100px]"
                  placeholder="Enter symptoms"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="med-input min-h-[80px]"
                  placeholder="Additional notes (optional)"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="med-input"
                />
              </div>
            </div>
          </section>

          <section className="med-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold med-title">Medicines</h3>
              <button type="button" onClick={addMedicine} className="med-button-secondary text-sm">
                + Add Medicine
              </button>
            </div>
            <div className="space-y-4">
              {medicines.map((med, index) => (
                <div key={index} className="med-detail-card">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold med-title">Medicine {index + 1}</p>
                    {medicines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Medicine Name *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={med.medicine_name}
                          onChange={(e) => updateMedicine(index, "medicine_name", e.target.value)}
                          className="med-input"
                          placeholder="Search brand or generic"
                          autoComplete="off"
                          required
                        />
                        {medicineSuggestions[index]?.length ? (
                          <div className="med-suggestion-list">
                            {medicineSuggestions[index].map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => applyMedicineSuggestion(index, suggestion)}
                                className="med-suggestion-item"
                              >
                                <span className="font-semibold">{suggestion.brand_name || suggestion.name}</span>
                                <span className="text-xs med-muted">
                                  {[
                                    suggestion.generic_name,
                                    suggestion.strength,
                                    suggestion.dosage_form,
                                  ]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Dosage *</label>
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                        className="med-input"
                        placeholder="e.g., 500mg"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Frequency *</label>
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                        className="med-input"
                        placeholder="e.g., Twice daily"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Duration *</label>
                      <input
                        type="text"
                        value={med.duration}
                        onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                        className="med-input"
                        placeholder="e.g., 5 days"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Food Instruction *</label>
                      <select
                        value={med.food_instruction}
                        onChange={(e) => updateMedicine(index, "food_instruction", e.target.value)}
                        className="med-input"
                        required
                      >
                        <option value="">Select</option>
                        <option value="Before food">Before food</option>
                        <option value="After food">After food</option>
                        <option value="With food">With food</option>
                        <option value="Any time">Any time</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Special Instructions</label>
                      <input
                        type="text"
                        value={med.special_instruction}
                        onChange={(e) => updateMedicine(index, "special_instruction", e.target.value)}
                        className="med-input"
                        placeholder="e.g., Take with water"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div className="med-alert med-alert-danger">{error}</div>
          ) : null}

          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="med-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="med-button flex-1">
              {loading ? "Creating..." : "Create Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrescriptionView({ prescription, token, onBack, onEdit, canDelete, onDelete }) {
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
                    <img src={`${API_BASE}${details.doctor_signature_url}`} alt="Signature" className="mt-2 h-16 w-auto" />
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

        <div className="mt-4 flex gap-3">
          {onEdit ? (
            <button type="button" onClick={onEdit} className="med-button flex-1">
              Edit Prescription
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={onDelete} className="med-button-danger flex-1">
              Delete Prescription
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EditPrescriptionForm({ prescription, token, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagnosis, setDiagnosis] = useState(prescription.diagnosis || "");
  const [symptoms, setSymptoms] = useState(prescription.symptoms || "");
  const [notes, setNotes] = useState(prescription.notes || "");
  const [followUpDate, setFollowUpDate] = useState(prescription.follow_up_date || "");
  const [medicines, setMedicines] = useState(
    prescription.medicines?.length
      ? prescription.medicines.map((med) => ({
          medicine_name: med.medicine_name || "",
          dosage: med.dosage || "",
          frequency: med.frequency || "",
          duration: med.duration || "",
          food_instruction: med.food_instruction || "",
          special_instruction: med.special_instruction || "",
        }))
      : [emptyMedicine()]
  );
  const [medicineSuggestions, setMedicineSuggestions] = useState({});
  const suggestionCacheRef = useRef(new Map());
  const suggestionTimersRef = useRef({});

  function addMedicine() {
    setMedicines([...medicines, emptyMedicine()]);
  }

  function removeMedicine(index) {
    if (medicines.length > 1) {
      setMedicines(medicines.filter((_, i) => i !== index));
    }
  }

  function updateMedicine(index, field, value) {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine,
      ),
    );
    if (field === "medicine_name") {
      scheduleMedicineSuggestions(index, value);
    }
  }

  function scheduleMedicineSuggestions(index, value) {
    const query = value.trim();
    window.clearTimeout(suggestionTimersRef.current[index]);
    if (query.length < 2) {
      setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
      return;
    }
    const cacheKey = query.toLowerCase();
    if (suggestionCacheRef.current.has(cacheKey)) {
      setMedicineSuggestions((current) => ({
        ...current,
        [index]: suggestionCacheRef.current.get(cacheKey),
      }));
      return;
    }
    suggestionTimersRef.current[index] = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/prescriptions/medicines/search?q=${encodeURIComponent(query)}&limit=8`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          return;
        }
        const results = Array.isArray(data) ? data : [];
        suggestionCacheRef.current.set(cacheKey, results);
        setMedicineSuggestions((current) => ({ ...current, [index]: results }));
      } catch {
        setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
      }
    }, 220);
  }

  function applyMedicineSuggestion(index, suggestion) {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index
          ? {
              ...medicine,
              medicine_name: suggestion.brand_name || suggestion.name,
              dosage: medicine.dosage || suggestion.strength || "",
            }
          : medicine,
      ),
    );
    setMedicineSuggestions((current) => ({ ...current, [index]: [] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!diagnosis.trim() || !symptoms.trim()) {
      setError("Diagnosis and symptoms are required");
      return;
    }
    if (medicines.some((med) => !med.medicine_name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim() || !med.food_instruction.trim())) {
      setError("All medicine fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/prescriptions/${prescription.prescription_id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diagnosis: diagnosis.trim(),
          symptoms: symptoms.trim(),
          notes: notes.trim() || null,
          follow_up_date: followUpDate || null,
          medicines: medicines.map((med) => ({
            medicine_name: med.medicine_name.trim(),
            dosage: med.dosage.trim(),
            frequency: med.frequency.trim(),
            duration: med.duration.trim(),
            food_instruction: med.food_instruction.trim(),
            special_instruction: med.special_instruction.trim() || null,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update prescription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="med-page">
      <div className="med-shell max-w-4xl">
        <div className="med-topbar">
          <h2 className="text-xl font-semibold med-title">Edit Prescription</h2>
          <button type="button" onClick={onCancel} className="med-button-secondary">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="med-card p-5 sm:p-6">
            <h3 className="mb-4 text-xl font-semibold med-title">Diagnosis & Symptoms</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Diagnosis *</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="med-input min-h-[100px]"
                  placeholder="Enter diagnosis"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Symptoms *</label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="med-input min-h-[100px]"
                  placeholder="Enter symptoms"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="med-input min-h-[80px]"
                  placeholder="Additional notes (optional)"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold med-title">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="med-input"
                />
              </div>
            </div>
          </section>

          <section className="med-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold med-title">Medicines</h3>
              <button type="button" onClick={addMedicine} className="med-button-secondary text-sm">
                + Add Medicine
              </button>
            </div>
            <div className="space-y-4">
              {medicines.map((med, index) => (
                <div key={index} className="med-detail-card">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-semibold med-title">Medicine {index + 1}</p>
                    {medicines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Medicine Name *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={med.medicine_name}
                          onChange={(e) => updateMedicine(index, "medicine_name", e.target.value)}
                          className="med-input"
                          placeholder="Search brand or generic"
                          autoComplete="off"
                          required
                        />
                        {medicineSuggestions[index]?.length ? (
                          <div className="med-suggestion-list">
                            {medicineSuggestions[index].map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => applyMedicineSuggestion(index, suggestion)}
                                className="med-suggestion-item"
                              >
                                <span className="font-semibold">{suggestion.brand_name || suggestion.name}</span>
                                <span className="text-xs med-muted">
                                  {[
                                    suggestion.generic_name,
                                    suggestion.strength,
                                    suggestion.dosage_form,
                                  ]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Dosage *</label>
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                        className="med-input"
                        placeholder="e.g., 500mg"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Frequency *</label>
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                        className="med-input"
                        placeholder="e.g., Twice daily"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Duration *</label>
                      <input
                        type="text"
                        value={med.duration}
                        onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                        className="med-input"
                        placeholder="e.g., 5 days"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Food Instruction *</label>
                      <select
                        value={med.food_instruction}
                        onChange={(e) => updateMedicine(index, "food_instruction", e.target.value)}
                        className="med-input"
                        required
                      >
                        <option value="">Select</option>
                        <option value="Before food">Before food</option>
                        <option value="After food">After food</option>
                        <option value="With food">With food</option>
                        <option value="Any time">Any time</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold med-title">Special Instructions</label>
                      <input
                        type="text"
                        value={med.special_instruction}
                        onChange={(e) => updateMedicine(index, "special_instruction", e.target.value)}
                        className="med-input"
                        placeholder="e.g., Take with water"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div className="med-alert med-alert-danger">{error}</div>
          ) : null}

          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="med-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="med-button flex-1">
              {loading ? "Updating..." : "Update Prescription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DoctorPrescriptions;
