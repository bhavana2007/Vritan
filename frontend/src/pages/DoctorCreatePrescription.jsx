import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

const emptyMedicine = () => ({
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  food_instruction: "",
  special_instruction: "",
});

function DoctorCreatePrescription() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patientData, setPatientData] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [medicineSuggestions, setMedicineSuggestions] = useState({});
  const suggestionCacheRef = useRef(new Map());
  const suggestionTimersRef = useRef({});
  const [accessTimer, setAccessTimer] = useState(null);

  useEffect(() => {
    async function fetchPatientData() {
      if (!patientId || !token) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/doctor/patient-by-id/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        setPatientData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load patient data");
      } finally {
        setLoading(false);
      }
    }

    fetchPatientData();
  }, [patientId, token]);

  useEffect(() => {
    if (!accessStatus?.expires_at) return;

    const updateTimer = () => {
      const expiresAt = new Date(accessStatus.expires_at);
      const now = new Date();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setAccessTimer("Expired");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setAccessTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [accessStatus?.expires_at]);

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
    if (!patientData) {
      setError("Patient data not loaded");
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
          patient_id: patientData.id,
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
      navigate("/doctor/prescriptions", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create prescription");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !patientData) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="prescriptions" />
        <main className="flex-1 ml-64 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !patientData) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="prescriptions" />
        <main className="flex-1 ml-64 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 mb-4">
              {error}
            </div>
            <button
              onClick={() => navigate("/doctor/patients")}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Patients
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="prescriptions" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 text-teal-600 hover:text-teal-700 font-medium"
          >
            ← Back
          </button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create Prescription</h1>
          </div>

          {patientData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Patient Information</h2>
                {accessTimer && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Access expires in:</span>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      {accessTimer}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Patient Name</p>
                  <p className="font-semibold text-gray-900">{patientData.full_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Patient ID</p>
                  <p className="font-semibold text-gray-900">{patientData.patient_uid}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Blood Group</p>
                  <p className="font-semibold text-gray-900">{patientData.blood_group || "N/A"}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Diagnosis & Symptoms</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Diagnosis *</label>
                  <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[100px]"
                    placeholder="Enter diagnosis"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Symptoms *</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[100px]"
                    placeholder="Enter symptoms"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Additional Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[80px]"
                    placeholder="Additional notes (optional)"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Medicines</h2>
                <button type="button" onClick={addMedicine} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                  + Add Medicine
                </button>
              </div>
              <div className="space-y-4">
                {medicines.map((med, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-gray-900">Medicine {index + 1}</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Medicine Name *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={med.medicine_name}
                            onChange={(e) => updateMedicine(index, "medicine_name", e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Search brand or generic"
                            autoComplete="off"
                            required
                          />
                          {medicineSuggestions[index]?.length ? (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {medicineSuggestions[index].map((suggestion) => (
                                <button
                                  key={suggestion.id}
                                  type="button"
                                  onClick={() => applyMedicineSuggestion(index, suggestion)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                  <span className="font-semibold">{suggestion.brand_name || suggestion.name}</span>
                                  <span className="text-xs text-gray-600 ml-2">
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
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Dosage *</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="e.g., 500mg"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Frequency *</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="e.g., Twice daily"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Duration *</label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="e.g., 5 days"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Food Instruction *</label>
                        <select
                          value={med.food_instruction}
                          onChange={(e) => updateMedicine(index, "food_instruction", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                        <label className="mb-1 block text-xs font-semibold text-gray-900">Special Instruction</label>
                        <input
                          type="text"
                          value={med.special_instruction}
                          onChange={(e) => updateMedicine(index, "special_instruction", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {loading ? "Creating..." : "Create Prescription"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default DoctorCreatePrescription;
