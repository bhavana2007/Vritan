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
            <HighlightText text={doctorOrHospital || structured.doctor_or_hospital || "Not detected"} query={searchQuery} />
          </p>
        </InfoSection>

        {record.detected_medicines?.length ? (
          <InfoSection label="Medicines">
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {record.detected_medicines.map((medicine, index) => (
                <div key={`${record.id}-medicine-${index}`} className="med-mini-card">
                  <p className="font-semibold text-teal-800">
                    <HighlightText text={medicine.name} query={searchQuery} />
                  </p>
                  {medicine.dosage ? (
                    <p className="text-sm med-muted">
                      Dosage: <HighlightText text={medicine.dosage} query={searchQuery} />
                    </p>
                  ) : null}
                  {medicine.duration ? (
                    <p className="text-sm med-muted">
                      Duration: <HighlightText text={medicine.duration} query={searchQuery} />
                    </p>
                  ) : null}
                  {medicine.instructions ? (
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
            {record.probable_conditions?.length ? (
              record.probable_conditions.map((condition, index) => {
                const conditionText = typeof condition === 'string' ? condition : (condition?.condition || 'Unknown');
                return (
                  <span key={`${record.id}-condition-${index}`} className="med-chip">
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
