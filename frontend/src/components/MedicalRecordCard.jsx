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

function formatRecordType(value) {
  if (!value) return "Other";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
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
  const structured = record.ai_structured_data || {};
  const advice = structured.advice || [];
  const doctorOrHospital = structured.doctor_or_hospital || "";

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
              <span className="med-chip">{formatRecordType(record.record_type)}</span>
              <span className="med-chip">{formatShortDate(record.uploaded_at)}</span>
              {structured.classification ? (
                <span className="med-chip">
                  {formatRecordType(structured.classification)}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-sm med-muted">{formatDateTime(record.uploaded_at)}</p>
        </div>

        <InfoSection label="Doctor/Hospital">
          <p className="mt-1 text-sm med-muted">
            <HighlightText text={doctorOrHospital || "Not detected"} query={searchQuery} />
          </p>
        </InfoSection>

        {record.detected_medicines?.length ? (
          <InfoSection label="Medicines, Dosage, Duration">
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {record.detected_medicines.map((medicine, index) => (
                <div key={`${record.id}-medicine-${index}`} className="med-mini-card">
                  <p className="font-semibold text-teal-800">
                    <HighlightText text={medicine.name} query={searchQuery} />
                  </p>
                  <p className="text-sm med-muted">
                    Dosage: {medicine.dosage || "Not detected"}
                  </p>
                  <p className="text-sm med-muted">
                    Duration: {medicine.duration || "Not detected"}
                  </p>
                </div>
              ))}
            </div>
          </InfoSection>
        ) : null}

        {advice.length ? (
          <InfoSection label="Advice">
            <div className="mt-2 flex flex-wrap gap-2">
              {advice.map((item, index) => (
                <span key={`${record.id}-advice-${index}`} className="med-chip">
                  <HighlightText text={item} query={searchQuery} />
                </span>
              ))}
            </div>
          </InfoSection>
        ) : null}

        {record.probable_conditions?.length ? (
          <InfoSection label="Possible Related Conditions">
            <div className="mt-2 flex flex-wrap gap-2">
              {record.probable_conditions.map((condition, index) => (
                <span key={`${record.id}-condition-${index}`} className="med-chip">
                  <HighlightText text={condition} query={searchQuery} />
                </span>
              ))}
            </div>
          </InfoSection>
        ) : null}

        {record.notes ? (
          <InfoSection label="Patient Notes">
            <p className="mt-1 text-sm med-muted">
              <HighlightText text={record.notes} query={searchQuery} />
            </p>
          </InfoSection>
        ) : null}

        {record.cleaned_text ? (
          <details className="mt-3 text-sm med-muted">
            <summary className="cursor-pointer font-semibold text-teal-700">
              OCR text
            </summary>
            <p className="mt-2 whitespace-pre-wrap">
              <HighlightText text={record.cleaned_text} query={searchQuery} />
            </p>
          </details>
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
