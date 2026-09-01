import React, { useState, useEffect } from "react";
import { prescriptionsApi } from "../api/prescriptions";

function formatDateLong(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Document type icons and display names from AI pipeline
const DOCUMENT_TYPE_INFO = {
  prescription: { icon: "💊", display: "Prescription", label: "Rx", color: "bg-blue-50 text-blue-700 border-blue-100" },
  blood_report: { icon: "🩸", display: "Blood Report", label: "Report", color: "bg-red-50 text-red-700 border-red-100" },
  lab_report: { icon: "🧪", display: "Lab Report", label: "Report", color: "bg-teal-50 text-teal-700 border-teal-100" },
  xray: { icon: "🩻", display: "X-Ray", label: "Scan", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  mri: { icon: "🧠", display: "MRI", label: "Scan", color: "bg-purple-50 text-purple-700 border-purple-100" },
  ct_scan: { icon: "🫀", display: "CT Scan", label: "Scan", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100" },
  ecg_report: { icon: "❤️", display: "ECG", label: "Report", color: "bg-rose-50 text-rose-700 border-rose-100" },
  ultrasound_report: { icon: "🔍", display: "Ultrasound", label: "Scan", color: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  medical_certificate: { icon: "📄", display: "Certificate", label: "Doc", color: "bg-slate-50 text-slate-700 border-slate-100" },
  hospital_bill: { icon: "🧾", display: "Bill", label: "Bill", color: "bg-amber-50 text-amber-700 border-amber-100" },
  insurance_document: { icon: "🛡", display: "Insurance", label: "Doc", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  vaccination_record: { icon: "💉", display: "Vaccination", label: "Record", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  discharge_summary: { icon: "🏥", display: "Discharge Summary", label: "Summary", color: "bg-orange-50 text-orange-700 border-orange-100" },
  referral_letter: { icon: "✉️", display: "Referral", label: "Letter", color: "bg-sky-50 text-sky-700 border-sky-100" },
  general_medical_report: { icon: "📋", display: "Medical Report", label: "Report", color: "bg-slate-50 text-slate-700 border-slate-100" },
  other_medical_document: { icon: "📁", display: "Other", label: "Doc", color: "bg-slate-50 text-slate-700 border-slate-100" },
  unknown: { icon: "❓", display: "Unknown", label: "Doc", color: "bg-slate-50 text-slate-700 border-slate-100" }
};

function getDocumentTypeInfo(documentType) {
  if (!documentType) return DOCUMENT_TYPE_INFO.unknown;
  const key = documentType.toLowerCase().replace(/-/g, "_");
  return DOCUMENT_TYPE_INFO[key] || DOCUMENT_TYPE_INFO.unknown;
}

function HighlightText({ text, query }) {
  const value = String(text || "");
  const term = String(query || "").trim();
  if (!term) return value;

  const index = value.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return value;

  return (
    <>
      {value.slice(0, index)}
      <mark className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{value.slice(index, index + term.length)}</mark>
      {value.slice(index + term.length)}
    </>
  );
}

// Very compact medicine row for list and modal
function CompactMedicineRow({ medicine, searchQuery = "", detailed = false }) {
  const isUnverified = medicine.requires_manual_review === true || medicine.unverified === true || medicine.validation_reason === "manual_review";
  const name = medicine.name || "Unknown Medicine";
  
  const infoParts = [];
  if (medicine.dosage) infoParts.push(medicine.dosage);
  if (medicine.frequency) infoParts.push(medicine.frequency);
  if (medicine.duration) infoParts.push(medicine.duration);
  const infoText = infoParts.join(" | ");

  return (
    <div className={`flex flex-col py-1.5 ${detailed ? 'border-b border-slate-100 last:border-0' : ''}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className={`shrink-0 w-2 h-2 rounded-full ${isUnverified ? 'bg-amber-400' : 'bg-emerald-400'}`} title={isUnverified ? "Requires Review" : "Verified"}></span>
        <span className="font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[200px]">
          <HighlightText text={name} query={searchQuery} />
        </span>
        {infoText && (
          <span className="text-slate-500 font-medium truncate">
            | <HighlightText text={infoText} query={searchQuery} />
          </span>
        )}
      </div>
      {detailed && medicine.instructions && (
        <div className="ml-4 mt-0.5 text-[10px] sm:text-xs text-slate-400 italic truncate">
          <HighlightText text={medicine.instructions} query={searchQuery} />
        </div>
      )}
    </div>
  );
}

function MedicalRecordCard({
  record,
  searchQuery = "",
  onView,
  onDelete,
  onRefresh,
  viewing = false,
  deleting = false,
  showDelete = false,
  allowQr = false,
}) {
  if (!record) return null;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [showAllMedicines, setShowAllMedicines] = useState(false);
  
  // Local confirmation state
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [localQrStatus, setLocalQrStatus] = useState(record.qr_status);
  const [localQrVerificationId, setLocalQrVerificationId] = useState(record.qr_verification_id);

  useEffect(() => {
    setLocalQrStatus(record.qr_status);
    setLocalQrVerificationId(record.qr_verification_id);
  }, [record.qr_status, record.qr_verification_id]);

  let structured = {};
  if (record.ai_structured_data) {
    if (typeof record.ai_structured_data === "object") {
      structured = record.ai_structured_data;
    } else if (typeof record.ai_structured_data === "string") {
      try {
        structured = JSON.parse(record.ai_structured_data) || {};
      } catch (e) {
        structured = {};
      }
    }
  }

  let docDisplayName = record?.doctor_name || structured?.doctor_name || "";
  let hospDisplayName = record?.hospital_name || structured?.hospital || "";
  
  if (structured?.doctor_or_hospital) {
    const parts = structured.doctor_or_hospital.split(" - ");
    if (parts.length > 1) {
      if (!docDisplayName) docDisplayName = parts[0].trim();
      if (!hospDisplayName) hospDisplayName = parts[1].trim();
    } else {
      if (!docDisplayName) docDisplayName = structured.doctor_or_hospital.trim();
    }
  }

  const documentType = record?.document_type || structured?.document_type || "unknown";
  const docTypeInfo = getDocumentTypeInfo(documentType);
  const confidenceScore = record?.confidence_score || structured?.confidence || 0;

  const medicines = Array.isArray(record?.detected_medicines)
    ? record.detected_medicines
    : (typeof record?.detected_medicines === "string"
      ? (() => { try { const parsed = JSON.parse(record.detected_medicines); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; } })()
      : []);

  const conditions = Array.isArray(record?.probable_conditions)
    ? record.probable_conditions
    : (typeof record?.probable_conditions === "string"
      ? (() => { try { const parsed = JSON.parse(record.probable_conditions); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; } })()
      : []);

  const isPrescription = documentType.toLowerCase() === "prescription" || record.record_type.toLowerCase() === "prescription";
  const isDigital = record.file_url?.includes("/prescriptions/");

  // Calculate unverified medicines count
  const unverifiedCount = isPrescription ? medicines.filter(
    m => m.requires_manual_review === true || m.unverified === true || m.validation_reason === "manual_review"
  ).length : 0;
  
  const hasUnverifiedMedicines = unverifiedCount > 0;
  const verifiedCount = medicines.length - unverifiedCount;

  const qrUrl = `https://verify.vritan.in/rx/${localQrVerificationId}`;

  const handleGenerateQR = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsGenerating(true);
    try {
      const payload = isDigital
        ? { prescription_id: record.id }
        : { medical_record_id: record.id };
      const response = await prescriptionsApi.generateQR(payload);
      setLocalQrStatus(response.status);
      setLocalQrVerificationId(response.verification_id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || "Unable to generate prescription QR. Please try again.";
      alert(msg);
      // Graceful error handling - if backend rejects despite local confirmation, unconfirm
      if (msg.toLowerCase().includes("manual review") || msg.toLowerCase().includes("review required")) {
        setIsConfirmed(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeQR = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!window.confirm("Are you sure you want to revoke this prescription's verification QR code? This action cannot be undone.")) {
      return;
    }
    setIsRevoking(true);
    try {
      await prescriptionsApi.revokeQR({ verification_id: localQrVerificationId });
      setLocalQrStatus("revoked");
      setLocalQrVerificationId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to revoke QR");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleShare = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const shareData = {
      title: "Vritan Prescription Verification",
      text: "Verify this prescription authenticity on Vritan secure audits.",
      url: qrUrl,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.log("Share failed/cancelled", err);
      }
    }
    navigator.clipboard.writeText(qrUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Compact Header Details
  const getHeaderTitle = () => {
    let cond = record.condition || structured?.condition || "";
    if (!cond && conditions.length > 0) cond = conditions[0];
    if (!cond && structured?.diagnosis) cond = structured.diagnosis;
    
    if (cond) {
      const cleanCondition = cond.replace("Possible related condition:", "").replace("Possible condition:", "").trim();
      if (cleanCondition && cleanCondition.toLowerCase() !== "unknown" && cleanCondition.toLowerCase() !== "not detected") {
        return isPrescription ? `Prescription \u2014 ${cleanCondition}` : cleanCondition;
      }
    }

    const docName = docDisplayName || structured?.doctor_or_hospital;
    if (docName && docName.toLowerCase() !== "unknown" && docName.toLowerCase() !== "not detected") {
      return isPrescription ? `Prescription \u2014 ${docName}` : docName;
    }

    return isPrescription ? "Prescription" : (record.display_title || record.original_filename);
  };

  const headerTitle = getHeaderTitle();
  const formattedDate = formatDateLong(record.uploaded_at);
  const cleanDocName = docDisplayName || "Unknown Doctor";
  const cleanHospName = hospDisplayName ? ` \u00B7 ${hospDisplayName}` : "";
  
  // If title already includes doctor, don't repeat it in subtitle
  const titleIncludesDoctor = headerTitle.includes(cleanDocName);
  const subtitleDoc = titleIncludesDoctor ? "" : ` \u00B7 ${cleanDocName}`;
  const headerSubtitle = `${formattedDate}${subtitleDoc}${cleanHospName}`;

  // QR Section
  const renderQRSection = () => {
    if (!isPrescription || !allowQr) return null;

    // State B: QR_ACTIVE
    if (localQrStatus === "active") {
      return (
        <div className="flex items-center gap-2">
          <span className="font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-[10px] sm:text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            QR Active
          </span>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQrModal(true); }} className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded border border-blue-100 transition-colors text-[10px] sm:text-xs">
            View QR
          </button>
          <button type="button" onClick={handleShare} className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded border border-slate-200 transition-colors text-[10px] sm:text-xs">
            Share
          </button>
          <button type="button" onClick={handleRevokeQR} disabled={isRevoking} className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded border border-red-100 transition-colors disabled:opacity-50 text-[10px] sm:text-xs">
            {isRevoking ? "Revoking..." : "Revoke"}
          </button>
        </div>
      );
    }

    // State D: QR_REVOKED
    if (localQrStatus === "revoked") {
      return (
        <div className="flex items-center gap-2">
          <span className="font-bold text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-100 text-[10px] sm:text-xs">
            QR Revoked
          </span>
          <button type="button" onClick={handleGenerateQR} disabled={isGenerating} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors disabled:opacity-50 text-[10px] sm:text-xs">
            {isGenerating ? "Generating..." : "Generate New QR"}
          </button>
        </div>
      );
    }

    // State A: NOT_GENERATED (Eligible or Confirmed locally)
    return (
      <div className="flex items-center gap-2">
        {isConfirmed && (
          <span className="font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-[10px] sm:text-xs">
            ✓ Prescription Confirmed
          </span>
        )}
        <button type="button" onClick={handleGenerateQR} disabled={isGenerating} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors disabled:opacity-50 text-[10px] sm:text-xs">
          {isGenerating ? "Generating..." : "Generate Prescription QR"}
        </button>
      </div>
    );
  };

  const medicineSubset = showAllMedicines ? medicines : medicines.slice(0, 3);
  const remainingMeds = Math.max(0, medicines.length - 3);

  return (
    <div className="med-timeline-item">
      <div className="med-timeline-dot" aria-hidden="true" />
      <article className="med-card overflow-hidden transition-all duration-300 hover:shadow-sm bg-white border border-slate-200 rounded-xl p-3 sm:p-4">
        
        {/* Compact Header & Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              <HighlightText text={headerTitle} query={searchQuery} />
            </h3>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 truncate">
              {headerSubtitle}
            </p>
          </div>
          <div className="flex gap-1.5 text-[10px] sm:text-xs font-bold shrink-0">
            <span className={`px-1.5 py-0.5 rounded border uppercase ${isPrescription ? "bg-blue-50 text-blue-700 border-blue-100" : docTypeInfo.color}`}>
              {isPrescription ? "Rx" : docTypeInfo.label}
            </span>
            {confidenceScore > 0 && (
              <span className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-100">
                Conf: {Math.round(confidenceScore)}%
              </span>
            )}
            {isPrescription && medicines.length > 0 && (
              <span className="px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-100">
                {medicines.length} Meds
              </span>
            )}
          </div>
        </div>

        {/* Compact Medicines Section */}
        {isPrescription && medicines.length > 0 && (
          <div className="mt-3 bg-slate-50/50 border border-slate-150 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
              <span className="font-bold text-slate-500">
                {medicines.length} medicines ({verifiedCount} verified, {unverifiedCount} require review)
              </span>
              {remainingMeds > 0 && !showAllMedicines && (
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAllMedicines(true); }} className="text-blue-600 hover:text-blue-700 font-bold focus:outline-none">
                  +{remainingMeds} more
                </button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {medicineSubset.map((medicine, index) => (
                <CompactMedicineRow key={`${record.id}-med-${index}`} medicine={medicine} searchQuery={searchQuery} />
              ))}
            </div>
            {showAllMedicines && remainingMeds > 0 && (
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowAllMedicines(false); }} className="mt-1 text-[10px] sm:text-xs text-slate-500 hover:text-slate-700 font-bold focus:outline-none">
                Show less
              </button>
            )}
          </div>
        )}

        {/* Workflow Actions */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {renderQRSection()}
          </div>
          
          <div className="flex items-center gap-2 ml-auto shrink-0 text-xs">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAiExpanded(!aiExpanded); }}
              className="px-2 py-1.5 font-bold text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              title="Toggle AI Details"
            >
              <svg className={`w-4 h-4 transform transition-transform duration-200 ${aiExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(record); }}
              disabled={viewing}
              className="px-3 py-1.5 font-bold border border-slate-200 text-slate-700 bg-white rounded shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {viewing ? "Opening..." : "View Original"}
            </button>
            {showDelete && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(record); }}
                disabled={deleting}
                className="px-3 py-1.5 font-bold border border-red-200 text-red-600 bg-white rounded shadow-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible AI processing details */}
        {aiExpanded && (
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:text-xs text-slate-500 animate-fade-in font-semibold">
            <div>
              <span className="text-slate-400 block font-bold">OCR Quality</span>
              <span className="text-slate-700">{record.ocr_quality_score ? `${Math.round(record.ocr_quality_score)}%` : "N/A"}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Classification</span>
              <span className="text-slate-700">{record.document_type || "prescription"}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Validation</span>
              <span className="text-slate-700">{record.schema_validation_passed ? "Passed" : "Manual Review"}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold">Processing Time</span>
              <span className="text-slate-700">{record.processing_time ? `${record.processing_time.toFixed(1)}s` : "N/A"}</span>
            </div>
          </div>
        )}
      </article>

      {/* Manual Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-900">Review Prescription</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Verify extracted medicines before generating QR.</p>
              </div>
              <button type="button" onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto grow">
              <div className="flex flex-col gap-2">
                {medicines.map((medicine, index) => (
                  <CompactMedicineRow key={`review-med-${index}`} medicine={medicine} detailed={true} />
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowReviewModal(false)} 
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setIsConfirmed(true);
                  setShowReviewModal(false);
                }} 
                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
              >
                Confirm Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Presentation Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fade-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center select-none">
            
            <div className="text-blue-600 font-extrabold tracking-wider text-sm uppercase">VRITAN</div>
            <div className="text-sm font-bold text-slate-500 mt-0.5">Prescription Verification</div>
            
            <div className="inline-block p-4 border border-slate-200 rounded-xl bg-slate-50/50 mt-4 mb-4 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="Prescription Authenticity QR Code"
                className="w-48 h-48 block mx-auto rounded"
              />
            </div>
            
            <p className="text-xs font-semibold text-slate-500 mb-4 px-2 leading-relaxed">
              Scan to verify prescription authenticity.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-center text-xs">
              <span className="font-mono text-slate-700 select-all font-bold">
                QR ID: RX-{localQrVerificationId ? localQrVerificationId.split("-").pop().slice(0, 8).toUpperCase() : ""}
              </span>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={handleShare} className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                Share
              </button>
              <button type="button" onClick={() => setShowQrModal(false)} className="flex-1 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Share Success Toast */}
      {copySuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold animate-fade-in z-50">
          Verification link copied.
        </div>
      )}
    </div>
  );
}

export default MedicalRecordCard;
