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

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

const DOCUMENT_TYPE_INFO = {
  prescription: { label: "Rx", display: "Prescription" },
  blood_report: { label: "Lab", display: "Blood Report" },
  lab_report: { label: "Lab", display: "Lab Report" },
  xray: { label: "XR", display: "X-Ray" },
  mri: { label: "MRI", display: "MRI" },
  ct_scan: { label: "CT", display: "CT Scan" },
  ecg_report: { label: "ECG", display: "ECG" },
  ultrasound_report: { label: "US", display: "Ultrasound" },
  medical_certificate: { label: "Cert", display: "Certificate" },
  hospital_bill: { label: "Bill", display: "Bill" },
  insurance_document: { label: "Ins", display: "Insurance" },
  vaccination_record: { label: "Vax", display: "Vaccination" },
  discharge_summary: { label: "Disc", display: "Discharge Summary" },
  referral_letter: { label: "Ref", display: "Referral" },
  general_medical_report: { label: "Med", display: "Medical Report" },
  other_medical_document: { label: "Doc", display: "Other" },
  unknown: { label: "Doc", display: "Unknown" },
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
      <mark className="med-highlight">{value.slice(index, index + term.length)}</mark>
      {value.slice(index + term.length)}
    </>
  );
}

function InfoSection({ label, children }) {
  if (!children) return null;
  return (
    <div className="mt-3">
      <p className="med-detail-label">{label}</p>
      {children}
    </div>
  );
}

function MedicalRecordCard({
  record,
  searchQuery = "",
  onView,
  onDelete,
  viewing = false,
  deleting = false,
  showDelete = false,
}) {
  if (!record) return null;

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

  const doctorOrHospital = structured?.doctor_or_hospital || "";
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

  return (
    <div className="med-timeline-item">
      <div className="med-timeline-dot" aria-hidden="true" />
      <article className="med-detail-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold med-title">
              <HighlightText
                text={record.display_title || record.original_filename}
                query={searchQuery}
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="med-chip">
                {docTypeInfo.label} - {docTypeInfo.display}
              </span>
              <span className="med-chip">{formatShortDate(record.uploaded_at)}</span>
              {confidenceScore > 0 ? (
                <span className="med-chip">
                  Confidence: {Math.round(confidenceScore)}%
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-sm med-muted">{formatDateTime(record.uploaded_at)}</p>
        </div>

        <InfoSection label="Doctor/Hospital">
          <p className="mt-1 text-sm med-muted">
            <HighlightText
              text={doctorOrHospital || "Not detected"}
              query={searchQuery}
            />
          </p>
        </InfoSection>

        {medicines && medicines.length > 0 ? (
          <InfoSection label="Medicines">
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {medicines.map((medicine, index) => (
                <div key={`${record.id || index}-medicine-${index}`} className="med-mini-card">
                  <p className="font-semibold text-teal-800">
                    <HighlightText text={medicine?.name || ""} query={searchQuery} />
                  </p>
                  {medicine?.dosage ? (
                    <p className="text-sm med-muted">
                      Dosage: <HighlightText text={medicine.dosage} query={searchQuery} />
                    </p>
                  ) : null}
                  {medicine?.duration ? (
                    <p className="text-sm med-muted">
                      Duration: <HighlightText text={medicine.duration} query={searchQuery} />
                    </p>
                  ) : null}
                  {medicine?.instructions ? (
                    <p className="text-sm med-muted">
                      Instructions: <HighlightText text={medicine.instructions} query={searchQuery} />
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </InfoSection>
        ) : null}

        <InfoSection label="Possible Related Conditions">
          <div className="mt-2 flex flex-wrap gap-2">
            {conditions && conditions.length > 0 ? (
              conditions.map((condition, index) => {
                const conditionText =
                  typeof condition === "string"
                    ? condition
                    : condition?.condition || "Unknown";
                return (
                  <span key={`${record.id || index}-condition-${index}`} className="med-chip">
                    <HighlightText text={conditionText} query={searchQuery} />
                  </span>
                );
              })
            ) : (
              <span className="med-chip">Unknown</span>
            )}
          </div>
        </InfoSection>

        {record.notes ? (
          <InfoSection label="Patient Notes">
            <p className="mt-1 text-sm med-muted">
              <HighlightText text={record.notes} query={searchQuery} />
            </p>
          </InfoSection>
        ) : null}

        {record.ai_summary || structured.ai_summary ? (
          <InfoSection label="AI Summary">
            <p className="mt-1 text-sm med-muted italic bg-slate-50 p-2 rounded border border-slate-100">
              <HighlightText text={record.ai_summary || structured.ai_summary} query={searchQuery} />
            </p>
          </InfoSection>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onView(record)}
            disabled={viewing}
            className="med-button-secondary"
          >
            {viewing ? "Opening..." : "View secure file"}
          </button>
          {showDelete ? (
            <button
              type="button"
              onClick={() => onDelete(record)}
              disabled={deleting}
              className="med-button-danger"
            >
              {deleting ? "Deleting..." : "Delete Record"}
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}

export default MedicalRecordCard;
