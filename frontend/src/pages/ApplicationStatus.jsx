import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";

const STATUS_CONFIG = {
  PENDING_EMAIL_VERIFICATION: {
    label: "Email Verification Pending",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: "📧",
    step: 1,
  },
  PENDING_ADMIN_VERIFICATION: {
    label: "Under Review",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: "🔍",
    step: 2,
  },
  PENDING_ADMIN_APPROVAL: {
    label: "Under Review",
    color: "#3b82f6",
    bg: "#eff6ff",
    border: "#bfdbfe",
    icon: "🔍",
    step: 2,
  },
  REQUEST_DOCS: {
    label: "Additional Documents Required",
    color: "#f97316",
    bg: "#fff7ed",
    border: "#fed7aa",
    icon: "📄",
    step: 2,
  },
  APPROVED: {
    label: "Approved",
    color: "#059669",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    icon: "✅",
    step: 4,
  },
  REJECTED: {
    label: "Rejected",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: "❌",
    step: 4,
  },
  SUSPENDED: {
    label: "Suspended",
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    icon: "⏸️",
    step: 4,
  },
};

const PIPELINE_STEPS = ["Submitted", "Under Review", "Admin Approval", "Final Decision"];

function StatusBadge({ statusCode }) {
  const cfg = STATUS_CONFIG[statusCode?.toUpperCase()] || {
    label: statusCode || "Unknown",
    color: "#6b7280",
    bg: "#f9fafb",
    border: "#e5e7eb",
    icon: "❓",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 14px",
        borderRadius: "999px",
        background: cfg.bg,
        border: `1.5px solid ${cfg.border}`,
        color: cfg.color,
        fontWeight: 700,
        fontSize: "13px",
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Pipeline({ statusCode }) {
  const cfg = STATUS_CONFIG[statusCode?.toUpperCase()];
  const currentStep = cfg?.step ?? 1;
  const isRejected = ["REJECTED", "SUSPENDED"].includes(statusCode?.toUpperCase());

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, width: "100%", marginBottom: "32px" }}>
      {PIPELINE_STEPS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep && !isRejected;
        const active = stepNum === currentStep;
        const rejected = isRejected && stepNum === currentStep;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                border: `2.5px solid ${done ? "#059669" : active && !rejected ? "#3b82f6" : rejected ? "#dc2626" : "#e2e8f0"}`,
                background: done ? "#059669" : active && !rejected ? "#eff6ff" : rejected ? "#fef2f2" : "#f8fafc",
                color: done ? "#fff" : active && !rejected ? "#3b82f6" : rejected ? "#dc2626" : "#94a3b8",
                zIndex: 2,
              }}
            >
              {done ? "✓" : rejected ? "✕" : stepNum}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                fontWeight: 700,
                color: done ? "#059669" : active ? (rejected ? "#dc2626" : "#3b82f6") : "#94a3b8",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 17,
                  left: "50%",
                  width: "100%",
                  height: 2,
                  background: done ? "#059669" : "#e2e8f0",
                  zIndex: 1,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineItem({ entry, isLast }) {
  return (
    <div style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 20 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#059669",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: "#d1fae5", minHeight: 20 }} />
        )}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{entry.status}</div>
        {entry.note && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{entry.note}</div>
        )}
        {entry.timestamp && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {new Date(entry.timestamp).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplicationStatus() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("app_id") || "";
  const [appId, setAppId] = useState(initialId);
  const [inputVal, setInputVal] = useState(initialId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const lookup = async (id) => {
    const trimmed = (id || "").trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter your Application ID.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/application-status?app_id=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || "Application not found. Please check your ID.");
        return;
      }
      setData(json);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) lookup(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 16px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 560 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏥</div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
          Application Status
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", fontWeight: 500 }}>
          Track your Vritan registration application
        </p>
      </div>

      {/* Lookup Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
          border: "1px solid #e2e8f0",
          padding: "32px",
          marginBottom: 24,
        }}
      >
        <label
          style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 8 }}
        >
          Application ID
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookup(inputVal)}
            placeholder="VR-APP-2026-000038"
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "monospace",
              letterSpacing: "0.5px",
              outline: "none",
              color: "#0f172a",
            }}
          />
          <button
            onClick={() => lookup(inputVal)}
            disabled={loading}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Checking…" : "Check Status"}
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8" }}>
          Your Application ID was shown after submitting your registration. It looks like{" "}
          <code style={{ fontWeight: 700, color: "#059669" }}>VR-APP-2026-000001</code>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "16px 20px",
            color: "#dc2626",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            background: "#fff",
            borderRadius: 20,
            boxShadow: "0 4px 32px rgba(0,0,0,0.07)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          {/* Org Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
              padding: "28px 32px",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a7f3d0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              Application {data.application_id}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{data.organization_name}</div>
            <div style={{ fontSize: 13, color: "#d1fae5", marginTop: 4 }}>{data.organization_type}</div>
          </div>

          <div style={{ padding: "28px 32px" }}>
            {/* Status Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>Current Status</span>
              <StatusBadge statusCode={data.status_code} />
            </div>

            {/* Pipeline */}
            <Pipeline statusCode={data.status_code} />

            {/* Vritan ID (if approved) */}
            {data.vritan_id && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #bbf7d0",
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  Vritan ID
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: "#065f46", letterSpacing: 1 }}>
                  {data.vritan_id}
                </div>
              </div>
            )}

            {/* Message */}
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: "14px 18px",
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.6,
                marginBottom: data.timeline?.length ? 24 : 0,
              }}
            >
              {data.message}
            </div>

            {/* Timeline */}
            {data.timeline?.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 16 }}>Status History</div>
                {data.timeline.map((entry, i) => (
                  <TimelineItem key={i} entry={entry} isLast={i === data.timeline.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Back link */}
      <div style={{ marginTop: 32, fontSize: 13 }}>
        <Link to="/register/hospital" style={{ color: "#059669", fontWeight: 700, textDecoration: "none" }}>
          ← Register a new organization
        </Link>
      </div>
    </div>
  );
}
