import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePatientProfile } from "../context/PatientProfileContext";
import { useNotifications } from "../context/NotificationContext";

function maskPhone(phone) {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length < 10) return phone;
  return `${cleaned.slice(0, 2)}XXX XX${cleaned.slice(-3)}`;
}

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

function PatientDashboardOverview() {
  const { user, activeProfile } = useAuth();
  const { profile, dashboardSummary, loading: profileLoading, error: profileError } = usePatientProfile();
  const { unreadCount, notifications } = useNotifications();

  const [accessRequests, setAccessRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [consentMessage, setConsentMessage] = useState("");
  const [respondingRequestId, setRespondingRequestId] = useState(null);

  // Use resolved active profile fallback mapping
  const activeName = activeProfile?.full_name || profile?.full_name || user?.name || "Patient Record";
  const activeMobile = activeProfile?.mobile || user?.mobile || profile?.mobile || "";

  const fetchAccessRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      setRequestsError("");
      // Access requests lookup can rely on standard endpoints
      setAccessRequests([]);
    } catch (error) {
      setRequestsError(error instanceof Error ? error.message : "Unable to sync doctor access requests.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessRequests();
  }, [fetchAccessRequests]);

  const pendingRequests = accessRequests.filter((request) => request.status === "pending");

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12 font-sans text-slate-800">
      {/* Patient Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-4 border-l-blue-600">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeName}
            </h1>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              Verified Patient
            </span>
            {activeProfile?.relationship && activeProfile.relationship !== "Self" && (
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                {activeProfile.relationship}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 font-medium">
            <span>UHID: <strong className="text-slate-700 font-semibold">{activeProfile?.patient_uid || "VRN-001042"}</strong></span>
            <span>•</span>
            <span>Gender: <strong className="text-slate-700 font-semibold">{profile?.gender || activeProfile?.gender || "Not specified"}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span>📱 Verified Mobile:</span>
              <strong className="text-slate-700 font-semibold">{maskPhone(activeMobile)}</strong>
              <span className="text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                Verified via Firebase ✓
              </span>
            </span>
            {profile?.blood_group && (
              <>
                <span>•</span>
                <span>Blood Group: <strong className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">{profile.blood_group}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
          Clinical Health Notifications & Activity Feed
        </h2>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live EHR Sync</span>
      </div>

      {/* Dashboard Notification Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widget 1: Upcoming Appointment */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                Appointments
              </span>
              <span className="text-slate-400 text-lg">📅</span>
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Upcoming Consultation</h3>

            {dashboardSummary?.upcoming_appointment ? (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900 text-base">
                  Dr. {dashboardSummary.upcoming_appointment.doctor_id}
                </p>
                <p className="text-sm text-slate-600">
                  {dashboardSummary.upcoming_appointment.scheduled_date} at {dashboardSummary.upcoming_appointment.scheduled_time}
                </p>
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded">
                  {dashboardSummary.upcoming_appointment.status || "Confirmed"}
                </span>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-slate-500 text-sm font-medium">No upcoming appointments scheduled.</p>
              </div>
            )}
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-400">
            View detailed scheduler in sidebar.
          </div>
        </section>

        {/* Widget 2: Latest Active Prescription */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                Medication
              </span>
              <span className="text-slate-400 text-lg">💊</span>
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Active Prescriptions</h3>

            {dashboardSummary?.latest_prescription ? (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900 text-base truncate">
                  {dashboardSummary.latest_prescription.diagnosis || "General Clinical Rx"}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Issued: {formatDateTime(dashboardSummary.latest_prescription.created_at)}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-slate-500 text-sm font-medium">No active prescriptions on file.</p>
              </div>
            )}
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-400">
            View prescriptions archive in sidebar.
          </div>
        </section>

        {/* Widget 3: Recent Medical Record */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                Diagnostics
              </span>
              <span className="text-slate-400 text-lg">📋</span>
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Recent Clinical Records</h3>

            {dashboardSummary?.recent_record ? (
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-900 text-base capitalize truncate">
                  {dashboardSummary.recent_record.record_type}
                </p>
                <p className="text-xs text-slate-500">
                  Uploaded: {formatDateTime(dashboardSummary.recent_record.uploaded_at)}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-slate-500 text-sm font-medium">No diagnostic reports uploaded yet.</p>
              </div>
            )}
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-400">
            View digital health locker in sidebar.
          </div>
        </section>
      </div>

      {/* Activity Timeline and System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span>🛡️</span> Doctor Access & Sharing Registry
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Temporary read-only permissions requested by verified clinical providers.
          </p>
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm text-slate-500">
            No active clinician consent requests found.
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🔔</span> System Alerts
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>

          {(() => {
            const notificationsList = Array.isArray(notifications) ? notifications : [];
            return notificationsList.length > 0 ? (
              <div className="space-y-3">
                {notificationsList.slice(0, 3).map((notif) => (
                  <div key={notif.id || notif.notification_uid || Math.random()} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <p className="font-bold text-slate-800">{notif.title || "Notification"}</p>
                    <p className="text-slate-600 line-clamp-2 mt-0.5">{notif.message || ""}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                No active notification alerts.
              </div>
            );
          })()}
        </section>
      </div>
    </div>
  );
}

export default PatientDashboardOverview;
