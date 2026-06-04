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

function Upload() {
  const { type } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedRecord, setUploadedRecord] = useState(null);

  const normalizedType = ["prescription", "report", "scan", "other"].includes(type)
    ? type
    : "other";
  const formattedType =
    normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    setMessage("");
    setErrorMessage("");
    setUploadedRecord(null);

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
      setFile(null);
      setNotes("");
      setUploadedRecord(data);
      setMessage(`${formattedType} uploaded successfully with OCR analysis.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="med-auth-page">
      <div className="w-full max-w-md med-card p-6 text-center sm:p-8">
        <img
          src="/logo.png"
          alt="MediLocker"
          className="mx-auto mb-4 h-16 w-16 object-contain"
        />
        <h1 className="mb-2 text-3xl med-title">Upload {formattedType}</h1>
        <p className="mb-6 text-sm med-muted">
          Add a secure medical file to your vault.
        </p>

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

          {file ? (
            <p className="med-alert med-alert-info text-left">
              Selected file: {file.name}
            </p>
          ) : null}

          <button type="submit" disabled={uploading} className="med-button w-full">
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="med-button-secondary w-full"
          >
            Back to Dashboard
          </button>
        </form>

        {message ? (
          <p className="mt-4 med-alert med-alert-success">{message}</p>
        ) : null}

        {uploadedRecord ? <StructuredUploadSummary record={uploadedRecord} /> : null}

        {errorMessage ? (
          <div className="mt-4 med-alert med-alert-danger">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setFile(null);
              }}
              className="mt-3 med-button-secondary w-full"
            >
              Retry upload
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Upload;
