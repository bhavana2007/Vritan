import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function PasswordStrength({ password }) {
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const pct = (passed / checks.length) * 100;
  const strengthColor =
    pct <= 40 ? "#dc2626" : pct <= 60 ? "#f59e0b" : pct <= 80 ? "#3b82f6" : "#059669";
  const strengthLabel =
    pct <= 40 ? "Weak" : pct <= 60 ? "Fair" : pct <= 80 ? "Good" : "Strong";

  if (!password) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 99,
            background: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: strengthColor,
              borderRadius: 99,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: strengthColor, minWidth: 40 }}>
          {strengthLabel}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {checks.map((c) => (
          <span
            key={c.label}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 99,
              background: c.ok ? "#f0fdf4" : "#f8fafc",
              color: c.ok ? "#059669" : "#94a3b8",
              border: `1px solid ${c.ok ? "#bbf7d0" : "#e2e8f0"}`,
            }}
          >
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [tokenState, setTokenState] = useState("checking"); // checking | valid | invalid | expired
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/validate-setup-token?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (json.valid) {
          setEmail(json.email || "");
          setTokenState("valid");
        } else {
          setTokenState(json.message?.includes("expired") ? "expired" : "invalid");
        }
      } catch {
        setTokenState("invalid");
      }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/complete-setup-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail || "Failed to set password. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 10,
    border: "1.5px solid #e2e8f0",
    fontSize: 15,
    fontFamily: "'Segoe UI', Arial, sans-serif",
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box",
    background: "#fff",
  };

  const Wrapper = ({ children }) => (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 60%, #f0f9ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 48px rgba(0,0,0,0.10)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            padding: "28px 36px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>
            🏥 Vritan
          </div>
          <div style={{ fontSize: 12, color: "#a7f3d0", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            Healthcare Network
          </div>
        </div>
        <div style={{ padding: "32px 36px" }}>{children}</div>
      </div>
    </div>
  );

  if (tokenState === "checking") {
    return (
      <Wrapper>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ color: "#64748b", fontWeight: 600 }}>Validating your setup link…</p>
        </div>
      </Wrapper>
    );
  }

  if (tokenState === "expired") {
    return (
      <Wrapper>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
          <h2 style={{ margin: "0 0 12px", color: "#0f172a", fontWeight: 800 }}>Link Expired</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This password setup link has expired (24-hour limit). Please contact{" "}
            <a href="mailto:support@vritan.in" style={{ color: "#059669", fontWeight: 700 }}>
              support@vritan.in
            </a>{" "}
            to request a new one.
          </p>
          <Link
            to="/application-status"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "#f1f5f9",
              color: "#374151",
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Check Application Status
          </Link>
        </div>
      </Wrapper>
    );
  }

  if (tokenState === "invalid") {
    return (
      <Wrapper>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <h2 style={{ margin: "0 0 12px", color: "#0f172a", fontWeight: 800 }}>Invalid Link</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This setup link is invalid or has already been used. If you've already set your password,
            you can log in directly.
          </p>
          <Link
            to="/login"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff",
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Go to Login
          </Link>
        </div>
      </Wrapper>
    );
  }

  if (done) {
    return (
      <Wrapper>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#f0fdf4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 16px",
              border: "2px solid #bbf7d0",
            }}
          >
            ✅
          </div>
          <h2 style={{ margin: "0 0 12px", color: "#065f46", fontWeight: 800, fontSize: 22 }}>
            Password Set Successfully!
          </h2>
          <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
            Your Vritan account is now fully activated. You can log in using your registered email
            {email && (
              <>
                {" "}
                <strong style={{ color: "#0f172a" }}>{email}</strong>
              </>
            )}{" "}
            and the password you just set.
          </p>
          <button
            onClick={() => navigate("/login")}
            style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, #059669, #047857)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Proceed to Login →
          </button>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: "0 0 6px", fontWeight: 800, color: "#0f172a", fontSize: 20 }}>
            Set Your Password
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
            Welcome to Vritan! Choose a strong password to activate your organization account.
          </p>
          {email && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
                fontSize: 13,
                fontWeight: 600,
                color: "#065f46",
              }}
            >
              Account: {email}
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              color: "#dc2626",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 6 }}>
              New Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#94a3b8",
                }}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 6 }}>
              Confirm Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  ...inputStyle,
                  paddingRight: 48,
                  borderColor:
                    confirmPassword && confirmPassword !== newPassword
                      ? "#fca5a5"
                      : confirmPassword && confirmPassword === newPassword
                      ? "#bbf7d0"
                      : "#e2e8f0",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#94a3b8",
                }}
              >
                {showConfirm ? "🙈" : "👁️"}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                Passwords do not match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
            style={{
              width: "100%",
              padding: "14px",
              background:
                submitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 8
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #059669, #047857)",
              color:
                submitting || !newPassword || newPassword !== confirmPassword || newPassword.length < 8
                  ? "#94a3b8"
                  : "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {submitting ? "Setting Password…" : "Set Password & Activate Account"}
          </button>
        </form>
      </div>
    </Wrapper>
  );
}
