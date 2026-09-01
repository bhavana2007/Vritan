import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";

function StructuredUploadSummary({ record }) {
  const structured = record.ai_structured_data || {};
  const advice = structured.advice || [];
  return (
    <div className="mt-4 text-left med-detail-card">
      <p className="mb-3 font-semibold med-title">
        {record.display_title || "Medical record summary"}
      </p>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <p className="med-detail-label">Doctor/Hospital</p>
          <p className="mt-1 text-sm med-muted">
            {structured.doctor_or_hospital || "Not detected"}
          </p>
        </div>
        {record.detected_medicines?.length ? (
          <div>
            <p className="med-detail-label">Medicines, Dosage, Duration</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {record.detected_medicines.map((medicine, index) => (
                <div key={`medicine-${index}`} className="med-mini-card">
                  <p className="font-semibold text-teal-800">{medicine.name}</p>
                  <p className="text-sm med-muted">
                    Dosage: {medicine.dosage || "Not detected"}
                  </p>
                  <p className="text-sm med-muted">
                    Duration: {medicine.duration || "Not detected"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {advice.length ? (
          <div>
            <p className="med-detail-label">Advice</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {advice.map((item, index) => (
                <span key={`advice-${index}`} className="med-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {record.probable_conditions?.length ? (
          <div>
            <p className="med-detail-label">Possible Related Conditions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {record.probable_conditions.map((condition, index) => (
                <span key={`condition-${index}`} className="med-chip">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {record.cleaned_text ? (
          <details className="text-sm med-muted">
            <summary className="cursor-pointer font-semibold text-teal-700">
              OCR text
            </summary>
            <p className="mt-2 whitespace-pre-wrap">{record.cleaned_text}</p>
          </details>
        ) : (
          <p className="text-sm med-muted">
            OCR details will appear when text is detected in the upload.
          </p>
        )}
      </div>
    </div>
  );
}

function UploadTimeline({ currentStepIndex, isUploading, isFailed }) {
  const steps = ["File Upload", "Image Enhancement", "OCR", "AI Analysis", "Medical Validation", "Record Saved"];
  return (
    <div className="mt-6 p-5 border border-slate-200 bg-white rounded-xl text-left shadow-sm">
      <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-wider">Vault Archiving Pipeline</h3>
      <div className="relative pl-6 border-l border-slate-200 ml-3 space-y-5">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex || (currentStepIndex === 5 && idx === 5);
          const isCurrent = idx === currentStepIndex && isUploading;
          const isStopped = idx === currentStepIndex && isFailed;
          let bulletBg = "bg-slate-100 text-slate-400";
          let bulletContent = <span>{idx + 1}</span>;
          let labelColor = "text-slate-400";
          let statusText = "Pending";
          let statusColor = "text-slate-400";

          if (isCompleted) {
            bulletBg = "bg-emerald-50 text-emerald-600 border border-emerald-250";
            bulletContent = (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            );
            labelColor = "text-slate-700 font-semibold";
            statusText = "Completed";
            statusColor = "text-emerald-600 font-medium";
          } else if (isCurrent) {
            bulletBg = "bg-blue-50 text-blue-600 border border-blue-200";
            bulletContent = <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span>;
            labelColor = "text-blue-900 font-bold";
            statusText = "Processing...";
            statusColor = "text-blue-600 font-semibold";
          } else if (isStopped) {
            bulletBg = "bg-rose-50 text-rose-600 border border-rose-200";
            bulletContent = (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            );
            labelColor = "text-rose-900 font-bold";
            statusText = "Stopped Here";
            statusColor = "text-rose-600 font-semibold";
          }

          return (
            <div key={idx} className="relative flex items-start gap-4">
              <div className={`absolute -left-[37px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold leading-none ${bulletBg}`}>
                {bulletContent}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs ${labelColor}`}>{step}</p>
                <p className={`text-[10px] ${statusColor} mt-0.5`}>{statusText}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Upload() {
  const { type } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedRecord, setUploadedRecord] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);

  const normalizedType = ["prescription", "report", "scan", "other"].includes(type) ? type : "other";
  const formattedType = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    setMessage("");
    setErrorMessage("");
    setErrorStatus(null);
    setUploadedRecord(null);
    setCurrentStepIndex(-1);

    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage("File size should be less than 10MB.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage(`Please select a ${formattedType} file.`);
      return;
    }

    const formData = new FormData();
    formData.append("record_type", normalizedType);
    formData.append("notes", notes);
    formData.append("file", file);

    setUploading(true);
    setMessage("");
    setErrorMessage("");
    setErrorStatus(null);
    setUploadedRecord(null);
    setCurrentStepIndex(0);

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1800);

    try {
      const response = await fetch(`${API_BASE}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      clearInterval(timer);

      if (!response.ok) {
        const err = new Error(parseFastApiDetail(data));
        err.status = response.status;
        throw err;
      }

      setCurrentStepIndex(5);
      setFile(null);
      setNotes("");
      setUploadedRecord(data);
      setMessage(`${formattedType} uploaded successfully with OCR analysis.`);
    } catch (error) {
      clearInterval(timer);
      setErrorStatus(error.status || null);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="med-auth-page">
      <div className="w-full max-w-md med-card p-6 text-center sm:p-8">
        <img src="/logo.png" alt="Vritan" className="mx-auto mb-4 h-16 w-16 object-contain" />
        <h1 className="mb-2 text-3xl med-title">Upload {formattedType}</h1>
        <p className="mb-6 text-sm med-muted">Add a secure medical file to your vault.</p>

        <form onSubmit={handleUpload} className="space-y-4">
          <label className="med-file-button border border-dashed border-cyan-200">
            Choose Image/PDF
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />
          </label>

          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={uploading}
            className="med-input text-left"
          />

          {file && (
            <div className="p-4 border border-slate-200 bg-white rounded-xl text-left shadow-sm relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                  {file.type === "application/pdf" ? (
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                    <span>{file.type || "Unknown"}</span>
                    <span>•</span>
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                    {uploading ? (
                      <span className="text-blue-600 flex items-center gap-1">
                        <span className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></span>
                        Processing...
                      </span>
                    ) : errorMessage ? (
                      <span className="text-rose-600">⚠ Stalled</span>
                    ) : uploadedRecord ? (
                      <span className="text-emerald-600">✓ Securely encrypted</span>
                    ) : (
                      <span className="text-slate-500">Ready to secure</span>
                    )}
                  </div>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setMessage(""); setErrorMessage(""); setErrorStatus(null); setCurrentStepIndex(-1); }}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {!uploading && !errorMessage && !uploadedRecord && (
            <button type="submit" className="med-button w-full">Upload</button>
          )}

          {(uploading || errorMessage || uploadedRecord) && currentStepIndex !== -1 && (
            <UploadTimeline currentStepIndex={currentStepIndex} isUploading={uploading} isFailed={!!errorMessage} />
          )}

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="med-button-secondary w-full"
          >
            Back to Dashboard
          </button>
        </form>

        {message && <p className="mt-4 med-alert med-alert-success">{message}</p>}

        {uploadedRecord && <StructuredUploadSummary record={uploadedRecord} />}

        {errorMessage && (
          <div className="mt-6 p-5 border border-rose-200 bg-rose-50/50 rounded-xl text-left shadow-sm animate-fade-in animate-duration-300">
            <div className="flex gap-3">
              <div className="text-rose-600 flex-shrink-0 mt-0.5">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-rose-900 leading-none">
                  {errorStatus === 422 ? "Document Verification Failed" : "Secure Upload Interrupted"}
                </h3>

                <p className="mt-2 text-sm text-slate-650 leading-relaxed text-slate-600">
                  {errorStatus === 422 ? (
                    "The uploaded document was not recognized as a valid medical record. Our secure archiving pipeline validates files to ensure safety and clinical readability. Processing may have stopped due to:"
                  ) : (
                    errorMessage || "An unexpected error occurred during document ingestion. Please check your file details and try again."
                  )}
                </p>

                {errorStatus === 422 && (
                  <ul className="mt-3 space-y-1.5 text-xs text-rose-800 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 mt-0.5">•</span>
                      <span><strong>Non-medical content:</strong> The file appears to be a receipt, selfie, screen capture, or other non-clinical artifact.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 mt-0.5">•</span>
                      <span><strong>Legibility issues:</strong> The camera frame is blurry, dark, or contains heavy glare.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-600 mt-0.5">•</span>
                      <span><strong>Insufficient text:</strong> The document lacks identifiable medical metadata, terms, or readable prescriptions.</span>
                    </li>
                  </ul>
                )}

                <div className="mt-5 border-t border-rose-200/50 pt-4">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                    Supported Document Checklist:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Prescriptions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Diagnostic Reports</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Radiology Reports</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Discharge Cards</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setErrorMessage("");
                      setErrorStatus(null);
                      setCurrentStepIndex(-1);
                    }}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold text-center transition-colors shadow-sm cursor-pointer"
                  >
                    Choose Another File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload;
