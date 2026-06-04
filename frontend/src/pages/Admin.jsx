import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";

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

function Admin() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [actingDoctorId, setActingDoctorId] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchDoctors = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/admin/doctors?status=${encodeURIComponent(statusFilter)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logout();
          navigate("/admin/login", { replace: true });
          return;
        }
        throw new Error(parseFastApiDetail(data));
      }
      setDoctors(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load doctor verification queue.",
      );
    } finally {
      setLoading(false);
    }
  }, [logout, navigate, statusFilter, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDoctors();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDoctors]);

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  async function updateDoctorStatus(doctor, action) {
    setActingDoctorId(doctor.user_id);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/admin/doctors/${doctor.user_id}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          logout();
          navigate("/admin/login", { replace: true });
          return;
        }
        throw new Error(parseFastApiDetail(data));
      }
      setDoctors((current) =>
        statusFilter === "all"
          ? current.map((item) => (item.user_id === doctor.user_id ? data : item))
          : current.filter((item) => item.user_id !== doctor.user_id),
      );
      setMessage(
        action === "approve"
          ? "Doctor approved successfully."
          : "Doctor verification rejected.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update doctor verification.",
      );
    } finally {
      setActingDoctorId(null);
    }
  }

  return (
    <div className="med-page">
      <div className="med-shell max-w-4xl">
        <div className="med-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo.png" alt="MediLocker" className="h-11 w-11 object-contain" />
            <p className="truncate text-sm med-muted">
              Admin &middot; {user?.email || "account"}
            </p>
          </div>
          <button type="button" onClick={handleLogout} className="med-button-secondary">
            Log out
          </button>
        </div>

        <section className="med-card p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold med-title">
                Doctor Verification
              </h1>
              <p className="mt-1 text-sm med-muted">
                Review doctor registrations before patient search and access workflows unlock.
              </p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="med-input sm:max-w-48"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All doctors</option>
            </select>
          </div>

          {message ? (
            <p className="mb-4 med-alert med-alert-success">{message}</p>
          ) : null}

          {errorMessage ? (
            <p className="mb-4 med-alert med-alert-danger">{errorMessage}</p>
          ) : null}

          {loading ? (
            <div className="med-alert med-alert-info">Loading doctors...</div>
          ) : null}

          {!loading && doctors.length === 0 ? (
            <div className="med-alert med-alert-info">
              No doctors found for this filter.
            </div>
          ) : null}

          <div className="space-y-3">
            {doctors.map((doctor) => (
              <div key={doctor.user_id} className="med-detail-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-semibold med-title">
                      {doctor.full_name || "Doctor"}
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm med-muted sm:grid-cols-2">
                      <p>Email: {doctor.email || "Not provided"}</p>
                      <p>Hospital: {doctor.hospital || "Not provided"}</p>
                      <p>Registered: {formatDateTime(doctor.created_at)}</p>
                      <p>Status: {doctor.verification_status}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                    <button
                      type="button"
                      disabled={actingDoctorId === doctor.user_id}
                      onClick={() => updateDoctorStatus(doctor, "approve")}
                      className="med-button-success"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actingDoctorId === doctor.user_id}
                      onClick={() => updateDoctorStatus(doctor, "reject")}
                      className="med-button-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Admin;
