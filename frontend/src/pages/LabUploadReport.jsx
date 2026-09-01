import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import LabSidebar from "../components/LabSidebar";

const REPORT_TYPES = [
  "Blood Test",
  "CBC",
  "LFT",
  "KFT",
  "HbA1c",
  "Lipid Profile",
  "Urine Test",
  "Thyroid",
  "X-Ray",
  "CT Scan",
  "MRI",
  "Ultrasound",
  "ECG",
  "2D Echo",
  "Biopsy",
  "Other"
];

function LabUploadReport() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId");

  const [patient, setPatient] = useState(null);
  const [reportType, setReportType] = useState("Blood Test");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // State for AI preview step
  const [step, setStep] = useState("upload"); // "upload", "preview", "success"
  const [draftRecord, setDraftRecord] = useState(null);
  const [progressText, setProgressText] = useState("");
  
  // Fields for technician to edit/review
  const [editDocType, setEditDocType] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editConditions, setEditConditions] = useState("");

  useEffect(() => {
    async function fetchPatient() {
      if (!patientId || !token) return;
      try {
        const response = await fetch(`${API_BASE}/doctor/patient-by-id/${patientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          setPatient(data);
        }
      } catch (err) {
        console.error("Failed to load patient data:", err);
      }
    }
    fetchPatient();
  }, [patientId, token]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadAndProcess = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a diagnostic report file to process.");
      return;
    }

    setLoading(true);
    setError("");

    const steps = [
      "Receiving diagnostic report file...",
      "Extracting text via high-resolution OCR Space API...",
      "Mapping findings and clinical values via Gemini AI...",
      "Packaging structured data and computing accuracy score...",
      "Generating final technician preview..."
    ];
    let stepIdx = 0;
    setProgressText(steps[0]);
    const timer = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setProgressText(steps[stepIdx]);
      } else {
        clearInterval(timer);
      }
    }, 1800);

    try {
      const formData = new FormData();
      formData.append("patient_id", patientId);
      formData.append("notes", notes);
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE}/lab/process-report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      clearInterval(timer);
      setDraftRecord(data);
      setEditDocType(data.document_type || reportType);
      setEditSummary(data.ai_summary || "");
      setEditConditions(JSON.stringify(data.probable_conditions || []));
      setStep("preview");
    } catch (err) {
      clearInterval(timer);
      setError(err instanceof Error ? err.message : "Report processing failed");
    } finally {
      clearInterval(timer);
      setLoading(false);
      setProgressText("");
    }
  };

  const handleFinalizeReport = async (e) => {
    e.preventDefault();
    if (!draftRecord) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("notes", notes);
      formData.append("document_type", editDocType);
      formData.append("ai_summary", editSummary);
      formData.append("probable_conditions", editConditions);

      const response = await fetch(`${API_BASE}/lab/finalize-report/${draftRecord.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setSuccess("Diagnostic report finalized, verified, and locked in patient timeline successfully!");
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report finalization failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <LabSidebar currentPage="patients" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Upload Laboratory Report</h1>
            {patient && (
              <p className="mt-2 text-slate-600">
                Uploading report for patient: <strong className="text-slate-900">{patient.full_name}</strong> ({patient.patient_uid})
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              {error}
            </div>
          )}

          {step === "upload" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Diagnostic File Upload</h2>
              
              <form onSubmit={handleUploadAndProcess} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Select Diagnostic Report Type
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-slate-800 font-medium"
                  >
                    {REPORT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Technician Notes (Optional)
                  </label>
                  <textarea
                    placeholder="Enter any initial notes or details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Report Document (PDF or Image)
                  </label>
                  <label className="block w-full px-4 py-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-teal-500 transition-colors text-center">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <div className="text-slate-600">
                      <span className="text-3xl block mb-2">📁</span>
                      <span className="font-semibold text-teal-600 block">Click to select report file</span>
                      <span className="text-xs text-slate-400">PDF, PNG, JPG up to 10MB</span>
                    </div>
                  </label>
                  {selectedFile && (
                    <p className="mt-3 text-sm text-teal-700 font-semibold">
                      Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/lab/patients")}
                    className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedFile}
                    className="px-8 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-300 flex items-center gap-2"
                  >
                    {loading && <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                    {loading ? "Processing..." : "Upload & Process"}
                  </button>
                </div>
                {loading && (
                  <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-2xl text-sm text-teal-800 font-semibold flex items-center gap-3 animate-pulse">
                    <span>⚡</span>
                    <span>{progressText}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {step === "preview" && draftRecord && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Preview AI Structured Findings</h2>
                  <p className="text-sm text-slate-500 mt-1">Review and correct the AI findings before locking in Patient EMR.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-semibold">AI Confidence</span>
                  <p className="text-lg font-bold text-teal-600">{draftRecord.confidence_score}%</p>
                </div>
              </div>

              <form onSubmit={handleFinalizeReport} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Classified Document Type
                    </label>
                    <input
                      type="text"
                      value={editDocType}
                      onChange={(e) => setEditDocType(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Structured Conditions / Parameters (JSON)
                    </label>
                    <input
                      type="text"
                      value={editConditions}
                      onChange={(e) => setEditConditions(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    AI Clinical Summary / Finding Details
                  </label>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 text-slate-800 font-medium"
                  />
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <h4 className="font-semibold text-slate-900 mb-2 text-sm">Original Extracted OCR Text (Read Only)</h4>
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto bg-white p-3 border border-slate-100 rounded-lg">
                    {draftRecord.extracted_text || "No text could be extracted."}
                  </pre>
                </div>

                <div className="border-t border-slate-100 pt-6 flex justify-between items-center">
                  <a
                    href={`${API_BASE}${draftRecord.file_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-600 font-semibold text-sm hover:underline"
                  >
                    View Uploaded File
                  </a>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("upload")}
                      className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? "Finalizing..." : "Submit Verified Report"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {step === "success" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <span className="text-5xl block mb-6 animate-bounce">✅</span>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Diagnostic Record Locked Successfully</h2>
              <p className="text-slate-600 mb-8 max-w-md mx-auto">
                {success}
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => navigate("/lab/dashboard")}
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold transition-colors"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate("/lab/patients")}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                >
                  Upload Another Report
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default LabUploadReport;
