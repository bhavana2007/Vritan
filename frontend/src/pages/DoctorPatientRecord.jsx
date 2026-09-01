import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";
import MedicalRecordCard from "../components/MedicalRecordCard";
import SecureFileViewer from "../components/SecureFileViewer";
import CountdownTimer from "../components/CountdownTimer";

function DoctorPatientRecord() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { patientUid } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [patientData, setPatientData] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingRecordId, setViewingRecordId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSearchFilter, setRecordSearchFilter] = useState("all");
  const [labDateFilter, setLabDateFilter] = useState("all");

  const tabs = [
    { id: "overview", label: "Overview", icon: "📋" },
    { id: "medical-records", label: "Medical Records", icon: "📁" },
    { id: "lab-reports", label: "Lab Reports", icon: "🔬" },
    { id: "prescription-history", label: "Prescription History", icon: "💊" },
    { id: "create-prescription", label: "Create Prescription", icon: "✍️" },
  ];

  const fetchPatientData = useCallback(async () => {
    if (!patientUid || !token) return;

    try {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/access-status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/ai-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const patientResponse = results[0].status === 'fulfilled' ? results[0].value : null;
      const accessResponse = results[1].status === 'fulfilled' ? results[1].value : null;
      const aiSummaryResponse = results[2].status === 'fulfilled' ? results[2].value : null;

      const patientData = patientResponse && patientResponse.ok ? await patientResponse.json().catch(() => ({})) : {};
      const accessData = accessResponse && accessResponse.ok ? await accessResponse.json().catch(() => ({})) : {};
      const aiSummaryData = aiSummaryResponse && aiSummaryResponse.ok ? await aiSummaryResponse.json().catch(() => null) : null;

      if (!patientResponse || !patientResponse.ok) {
        throw new Error(parseFastApiDetail(patientData) || "Could not load patient data");
      }

      setPatientData(patientData);
      setAccessStatus(accessData);
      setAiSummary(aiSummaryData);

      if (accessData.status === "approved") {
        await fetchMedicalRecords();
        await fetchLabReports();
        await fetchPrescriptions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load patient data");
    } finally {
      setLoading(false);
    }
  }, [patientUid, token]);

  const fetchMedicalRecords = useCallback(async () => {
    if (!patientUid || !token) return;

    try {
      const params = new URLSearchParams();
      if (recordSearch.trim()) {
        params.set("q", recordSearch.trim());
      }
      params.set("filter", recordSearchFilter);

      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/records${params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setMedicalRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch medical records:", err);
    }
  }, [patientUid, token, recordSearch, recordSearchFilter]);

  const fetchLabReports = useCallback(async () => {
    if (!patientUid || !token) return;

    try {
      const params = new URLSearchParams();
      params.set("type", "lab_report");
      if (labDateFilter !== "all") {
        params.set("date_filter", labDateFilter);
      }

      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/records${params.toString() ? `?${params.toString()}` : ""
        }`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setLabReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch lab reports:", err);
    }
  }, [patientUid, token, labDateFilter]);

  const fetchPrescriptions = useCallback(async () => {
    if (!patientUid || !token) return;

    try {
      const response = await fetch(
        `${API_BASE}/prescriptions?patient_id=${patientData?.id || ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPrescriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch prescriptions:", err);
    }
  }, [patientUid, token, patientData?.id]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  useEffect(() => {
    if (activeTab === "medical-records") {
      fetchMedicalRecords();
    }
    if (activeTab === "lab-reports") {
      fetchLabReports();
    }
    if (activeTab === "prescription-history") {
      fetchPrescriptions();
    }
  }, [activeTab, fetchMedicalRecords, fetchLabReports, fetchPrescriptions]);

  async function handleViewRecord(record) {
    setViewingRecordId(record.id);

    try {
      const response = await fetch(`${API_BASE}${record.file_url}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.blob();
      if (!response.ok) {
        const payload = await data.text().then(JSON.parse).catch(() => ({}));
        throw new Error(parseFastApiDetail(payload));
      }
      const objectUrl = window.URL.createObjectURL(data);
      setViewerFile({
        url: objectUrl,
        filename: record.original_filename,
        mimeType: data.type || "",
      });
    } catch (err) {
      console.error("Failed to view record:", err);
    } finally {
      setViewingRecordId(null);
    }
  }

  function closeViewer() {
    if (viewerFile?.url) {
      window.URL.revokeObjectURL(viewerFile.url);
    }
    setViewerFile(null);
  }

  function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  function formatDateTime(value) {
    if (!value) return "";
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

  function getAccessTimer() {
    if (!accessStatus?.expires_at) return null;
    const expiresAt = new Date(accessStatus.expires_at);
    const now = new Date();
    const diff = expiresAt - now;

    if (diff <= 0) {
      return "Expired";
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function getAccessBadge(status) {
    const statusStyles = {
      approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      denied: "bg-red-100 text-red-700 border-red-200",
      expired: "bg-gray-100 text-gray-700 border-gray-200",
      none: "bg-gray-100 text-gray-700 border-gray-200",
    };
    const style = statusStyles[status] || statusStyles.none;
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${style}`}>
        {status === "approved" ? "Active" : status === "pending" ? "Pending" : status === "denied" ? "Denied" : status === "expired" ? "Expired" : "No Access"}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="patients" />
        <main className="flex-1 p-8 min-w-0">
          <div className="flex items-center justify-center h-full">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !patientData) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="patients" />
        <main className="flex-1 p-8 min-w-0">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
              {error || "Patient not found"}
            </div>
            <button
              onClick={() => navigate("/doctor/patients")}
              className="mt-4 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Patients
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar currentPage="patients" />
      <SecureFileViewer file={viewerFile} onClose={closeViewer} />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate("/doctor/patients")}
            className="mb-6 text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Patients
          </button>

          {/* SECTION 1: Patient Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-start gap-6">
                {/* Patient Avatar */}
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white text-3xl font-semibold flex-shrink-0">
                  {patientData.full_name?.charAt(0) || "P"}
                </div>

                {/* Patient Info */}
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{patientData.full_name}</h1>
                  <p className="text-slate-600 mt-1">Patient ID: {patientData.patient_uid}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Age: {calculateAge(patientData.date_of_birth)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Gender: {patientData.gender || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span>Blood Group: {patientData.blood_group || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Status & Timer */}
              <div className="flex flex-col items-end gap-3">
                {getAccessBadge(accessStatus?.status)}
                {accessStatus?.status === "approved" && accessStatus?.expires_at && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-slate-600">Access expires in:</span>
                    <CountdownTimer
                      expiresAt={accessStatus.expires_at}
                      onExpire={() => setAccessStatus(prev => ({ ...prev, status: "expired" }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
              {patientData.primary_physician && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <p className="text-xs text-slate-500">Primary Physician</p>
                    <p className="text-sm font-medium text-slate-900">{patientData.primary_physician}</p>
                  </div>
                </div>
              )}
              {patientData.emergency_contact && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l2.257-1.13a1 1 0 011.21.502l1.498 4.493a1 1 0 01-.684.949l-2.285.457a11.042 11.042 0 01-11.042-11.042l.457-2.285a1 1 0 01.949-.684z" />
                  </svg>
                  <div>
                    <p className="text-xs text-slate-500">Emergency Contact</p>
                    <p className="text-sm font-medium text-slate-900">{patientData.emergency_contact}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Clinical Snapshot (AI Generated) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Clinical Snapshot</h2>
                <p className="text-sm text-slate-500">AI-generated summary from available patient records</p>
              </div>
            </div>

            {aiSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiSummary.known_conditions && aiSummary.known_conditions.length > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs font-medium text-blue-600 uppercase">Known Conditions</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.known_conditions.join(", ")}</p>
                  </div>
                )}
                {aiSummary.known_allergies && aiSummary.known_allergies.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs font-medium text-red-600 uppercase">Known Allergies</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.known_allergies.join(", ")}</p>
                  </div>
                )}
                {aiSummary.current_medications && aiSummary.current_medications.length > 0 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <p className="text-xs font-medium text-emerald-600 uppercase">Current Medications</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.current_medications.join(", ")}</p>
                  </div>
                )}
                {aiSummary.latest_diagnosis && (
                  <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-xs font-medium text-violet-600 uppercase">Latest Diagnosis</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.latest_diagnosis}</p>
                  </div>
                )}
                {aiSummary.latest_lab_report && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs font-medium text-amber-600 uppercase">Latest Lab Report</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.latest_lab_report}</p>
                  </div>
                )}
                {aiSummary.recent_prescription && (
                  <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs font-medium text-teal-600 uppercase">Recent Prescription</p>
                    </div>
                    <p className="text-sm text-slate-900">{aiSummary.recent_prescription}</p>
                  </div>
                )}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase">Total Medical Records</p>
                  </div>
                  <p className="text-sm text-slate-900">{medicalRecords.length} records</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">No clinical snapshot available</p>
                <p className="text-sm text-slate-500 mt-1">AI summary will be generated once records are available</p>
              </div>
            )}
          </div>

          {/* SECTION 3: Modern Navigation Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
            <div className="border-b border-slate-200">
              <nav className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                        ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* SECTION 4: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500 mb-1">Age</p>
                        <p className="text-lg font-semibold text-slate-900">{calculateAge(patientData.date_of_birth)}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500 mb-1">Gender</p>
                        <p className="text-lg font-semibold text-slate-900">{patientData.gender || "N/A"}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500 mb-1">Blood Group</p>
                        <p className="text-lg font-semibold text-slate-900">{patientData.blood_group || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vitals */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Vitals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500 mb-1">Height</p>
                        <p className="text-lg font-semibold text-slate-900">{patientData.height ? `${patientData.height} cm` : "N/A"}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500 mb-1">Weight</p>
                        <p className="text-lg font-semibold text-slate-900">{patientData.weight ? `${patientData.weight} kg` : "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Medical Summary */}
                  {patientData.allergies && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Allergies
                      </h3>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-red-900">{patientData.allergies}</p>
                      </div>
                    </div>
                  )}

                  {/* Emergency Information */}
                  {patientData.emergency_contact && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l2.257-1.13a1 1 0 011.21.502l1.498 4.493a1 1 0 01-.684.949l-2.285.457a11.042 11.042 0 01-11.042-11.042l.457-2.285a1 1 0 01.949-.684z" />
                        </svg>
                        Emergency Contact
                      </h3>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-red-900">{patientData.emergency_contact}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 5: Medical Records - Vertical Timeline */}
              {activeTab === "medical-records" && (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="search"
                      placeholder="Search medicines, conditions, notes, or OCR text"
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <select
                      value={recordSearchFilter}
                      onChange={(e) => setRecordSearchFilter(e.target.value)}
                      className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All tags</option>
                      <option value="medicine">Medicine</option>
                      <option value="condition">Condition</option>
                      <option value="ocr">OCR text</option>
                      <option value="type">Record type</option>
                    </select>
                    <button
                      onClick={fetchMedicalRecords}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                    >
                      Search
                    </button>
                  </div>
                  {medicalRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium">No medical records found</p>
                      <p className="text-sm text-slate-500 mt-1">Records will appear here once uploaded</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medicalRecords.map((record) => (
                        <div key={record.id} className="relative pl-8 pb-8 border-l-2 border-slate-200 last:border-l-0">
                          <div className="absolute left-0 top-0 w-4 h-4 bg-emerald-500 rounded-full -translate-x-[9px] border-4 border-white"></div>
                          <MedicalRecordCard
                            record={record}
                            searchQuery={recordSearch}
                            onView={handleViewRecord}
                            viewing={viewingRecordId === record.id}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 6: Lab Reports - Timeline Layout */}
              {activeTab === "lab-reports" && (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={labDateFilter}
                      onChange={(e) => setLabDateFilter(e.target.value)}
                      className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="year">This Year</option>
                    </select>
                    <button
                      onClick={fetchLabReports}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                    >
                      Filter
                    </button>
                  </div>
                  {labReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium">No lab reports found</p>
                      <p className="text-sm text-slate-500 mt-1">Lab reports will appear here once uploaded</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {labReports.map((report) => (
                        <div key={report.id} className="relative pl-8 pb-8 border-l-2 border-slate-200 last:border-l-0">
                          <div className="absolute left-0 top-0 w-4 h-4 bg-violet-500 rounded-full -translate-x-[9px] border-4 border-white"></div>
                          <MedicalRecordCard
                            record={report}
                            searchQuery={recordSearch}
                            onView={handleViewRecord}
                            viewing={viewingRecordId === report.id}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 7: Prescription History */}
              {activeTab === "prescription-history" && (
                <div>
                  {prescriptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <p className="text-slate-600 font-medium">No prescriptions found</p>
                      <p className="text-sm text-slate-500 mt-1">Prescriptions will appear here once created</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {prescriptions.map((prescription) => (
                        <div key={prescription.id} className="p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="font-semibold text-slate-900">{prescription.prescription_id}</p>
                              <p className="text-sm text-slate-600 mt-1">Diagnosis: {prescription.diagnosis}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${prescription.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-800"
                              }`}>
                              {prescription.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Medicines</p>
                              <p className="text-sm text-slate-900">{prescription.medicines?.map(m => m.medicine_name).join(", ") || "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Created Date</p>
                              <p className="text-sm text-slate-900">{formatDateTime(prescription.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Doctor: {prescription.doctor_name || "N/A"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 8: Create Prescription */}
              {activeTab === "create-prescription" && (
                <div>
                  {accessStatus?.status !== "approved" ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className="text-red-600 font-medium mb-2">Access Required</p>
                      <p className="text-slate-600 mb-4">You need approved access to create prescriptions for this patient.</p>
                      <button
                        onClick={() => navigate("/doctor/patients")}
                        className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-colors font-medium"
                      >
                        Back to Patients
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-slate-600 mb-2">Ready to create prescription for {patientData.full_name}</p>
                      <p className="text-sm text-slate-500 mb-4">You have active access to this patient's records</p>
                      <button
                        onClick={() => navigate(`/doctor/prescriptions/create?patientId=${patientData.id}`)}
                        className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all font-semibold shadow-lg shadow-emerald-200"
                      >
                        Create New Prescription
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DoctorPatientRecord;
