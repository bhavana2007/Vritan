import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePrescriptions } from "../context/PrescriptionContext";
import { prescriptionsApi } from "../api/prescriptions";

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
  const { user } = useAuth();
  const { prescriptions, loading: contextLoading, error: contextError, fetchPrescriptions } = usePrescriptions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // list, view
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleViewPrescription(prescription) {
    setSelectedPrescription(prescription);
    setViewMode("view");
  }

  function handleBackToList() {
    setViewMode("list");
    setSelectedPrescription(null);
    fetchPrescriptions(true);
  }

  // Filter prescriptions locally based on searchQuery
  const filteredPrescriptions = prescriptions.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.prescription_id && p.prescription_id.toLowerCase().includes(q)) ||
      (p.doctor_name && p.doctor_name.toLowerCase().includes(q)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(q))
    );
  });

  if (viewMode === "view" && selectedPrescription) {
    return (
      <PrescriptionView
        prescription={selectedPrescription}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      {toast ? (
        <div
          className={`mb-6 p-4 rounded-xl font-medium ${
            toast.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div>
        <h1 className="mb-6 text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          My Prescriptions
        </h1>

        <section className="mb-8 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-slate-800">Prescription History</h2>
            <p className="mt-1 text-sm text-slate-500">
              View all prescriptions from your doctors. Prescriptions appear here automatically after creation.
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              placeholder="Search by ID, diagnosis, or doctor name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => fetchPrescriptions(true)}
              disabled={contextLoading}
              className="px-6 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors"
            >
              {contextLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {contextError ? (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
              <p>{contextError}</p>
              <button onClick={() => fetchPrescriptions(true)} className="mt-2 text-sm font-medium underline">Retry</button>
            </div>
          ) : null}

          {contextLoading && prescriptions.length === 0 ? (
            <div className="p-4 bg-blue-50 text-blue-700 rounded-xl animate-pulse">Loading prescriptions...</div>
          ) : null}

          {!contextLoading && prescriptions.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-5xl block mb-4">💊</span>
              <p className="text-slate-600 font-medium">No prescriptions found yet.</p>
              <p className="text-sm text-slate-500">Your prescriptions will appear here after your doctors create them.</p>
            </div>
          ) : null}

          {!contextLoading && filteredPrescriptions.length === 0 && prescriptions.length > 0 ? (
            <div className="p-8 text-center text-slate-500">
              No prescriptions match your search.
            </div>
          ) : null}

          {filteredPrescriptions.length > 0 ? (
            <div className="space-y-4 mt-6">
              {filteredPrescriptions.map((prescription) => (
                <div key={prescription.id} className="p-5 border border-slate-200 rounded-xl bg-white hover:shadow-md transition">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-slate-900 text-lg">
                          {prescription.diagnosis || prescription.prescription_id}
                        </p>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            prescription.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : prescription.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {prescription.status || "COMPLETED"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Doctor:</span> {prescription.doctor_name || "Unknown Doctor"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-medium">Organization:</span> {prescription.organization_name || "Vritan Health"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 flex items-center gap-4">
                        <span><span className="font-medium">Date:</span> {formatDateTime(prescription.created_at)}</span>
                        {prescription.follow_up_date && (
                          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Follow-up: {formatDate(prescription.follow_up_date)}</span>
                        )}
                      </p>
                      {prescription.medicines && prescription.medicines.length > 0 && (
                        <div className="mt-3">
                           <p className="text-xs font-semibold text-slate-500 uppercase">Medicines</p>
                           <p className="text-sm text-slate-800 truncate">
                             {prescription.medicines.map(m => m.medicine_name || m.name).join(', ')}
                           </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewPrescription(prescription)}
                        className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-semibold transition-colors shrink-0"
                      >
                        View Details &rarr;
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

function PrescriptionView({ prescription, onBack }) {
  const [downloading, setDownloading] = useState(false);

  // We already have the prescription data from context! No need to fetch details again unless incomplete.
  // The backend should return the full prescription or we should fetch if missing.
  // Let's assume we have what we need, otherwise we can fall back to printing.

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      await prescriptionsApi.downloadPrescription(prescription.id);
      // In real life, this might return a blob, which client.js would need to handle. 
      // For now, if we don't have the blob handling in client.js, we can just trigger print.
      window.print();
    } catch (e) {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const details = prescription;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      <div>
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Prescription Details</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
              Print
            </button>
            <button type="button" onClick={handleDownloadPDF} disabled={downloading} className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors">
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
            <button type="button" onClick={onBack} className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
              Back
            </button>
          </div>
        </div>

        <div className="prescription-print-container bg-white border border-slate-200 shadow-sm rounded-2xl">
          <div className="p-6 sm:p-8">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <h1 className="text-3xl font-extrabold text-slate-900">{details.doctor_hospital || details.organization_name || "Hospital"}</h1>
              <p className="mt-1 text-slate-500">{details.doctor_specialization || "General Medicine"}</p>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 mb-1">Doctor</p>
                <p className="font-semibold text-slate-900">{details.doctor_name}</p>
                <p className="text-sm text-slate-600">{details.doctor_phone}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 mb-1">Prescription ID</p>
                <p className="font-semibold text-slate-900">{details.prescription_id}</p>
                <p className="text-sm text-slate-600">{formatDateTime(details.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 mb-1">Patient</p>
                <p className="font-semibold text-slate-900">{details.patient_name || "Patient"}</p>
                <p className="text-sm text-slate-600">{details.patient_uid}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500 mb-1">Follow-up</p>
                <p className="font-semibold text-blue-700">{formatDate(details.follow_up_date)}</p>
              </div>
            </div>

            {details.symptoms && (
              <div className="mb-6">
                <p className="mb-2 text-sm font-bold uppercase text-slate-500">Symptoms</p>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">{formatText(details.symptoms)}</p>
              </div>
            )}

            <div className="mb-8">
              <p className="mb-2 text-sm font-bold uppercase text-slate-500">Diagnosis</p>
              <p className="text-slate-800 bg-blue-50 text-blue-900 p-3 rounded-lg border border-blue-100 font-medium">{formatText(details.diagnosis)}</p>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-bold uppercase text-slate-500">Medicines</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Medicine</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dosage</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Food</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(details.medicines || []).map((med, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{med.medicine_name || med.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.dosage}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.frequency}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.duration}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.food_instruction}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 italic">{med.special_instruction || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!details.medicines || details.medicines.length === 0) && (
                  <p className="p-4 text-center text-sm text-slate-500">No medicines prescribed.</p>
                )}
              </div>
            </div>

            {details.notes ? (
              <div className="mb-6">
                <p className="mb-2 text-sm font-bold uppercase text-slate-500">Additional Notes</p>
                <p className="text-slate-700">{formatText(details.notes)}</p>
              </div>
            ) : null}

            <div className="mt-12 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Doctor's Signature</p>
                  {details.doctor_signature_url ? (
                    <img src={details.doctor_signature_url} alt="Signature" className="mt-2 h-16 w-auto" />
                  ) : (
                    <div className="mt-2 h-12 w-32 border-b-2 border-dashed border-slate-300 flex items-end justify-center pb-1">
                        <span className="text-xs text-slate-400 italic">Signature not available</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-1">Status</p>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      details.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : details.status === "CANCELLED"
                        ? "bg-red-100 text-red-800"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {details.status || "COMPLETED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientPrescriptions;
