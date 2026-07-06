import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";
import MedicalRecordCard from "../components/MedicalRecordCard";
import SecureFileViewer from "../components/SecureFileViewer";

function DoctorPatientRecord() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { patientUid } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [patientData, setPatientData] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingRecordId, setViewingRecordId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSearchFilter, setRecordSearchFilter] = useState("all");

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

      const [patientResponse, accessResponse] = await Promise.all([
        fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/access-status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const patientData = await patientResponse.json().catch(() => ({}));
      const accessData = await accessResponse.json().catch(() => ({}));

      if (!patientResponse.ok) {
        throw new Error(parseFastApiDetail(patientData));
      }

      setPatientData(patientData);
      setAccessStatus(accessData);

      if (accessData.status === "approved") {
        await fetchMedicalRecords();
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
        `${API_BASE}/doctor/patient/${encodeURIComponent(patientUid)}/records${
          params.toString() ? `?${params.toString()}` : ""
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
    if (activeTab === "medical-records" || activeTab === "lab-reports") {
      fetchMedicalRecords();
    }
    if (activeTab === "prescription-history") {
      fetchPrescriptions();
    }
  }, [activeTab, fetchMedicalRecords, fetchPrescriptions]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="patients" />
        <main className="flex-1 ml-64 p-8">
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
        <main className="flex-1 ml-64 p-8">
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
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="patients" />
      <SecureFileViewer file={viewerFile} onClose={closeViewer} />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate("/doctor/patients")}
              className="text-teal-600 hover:text-teal-700 font-medium mb-4 inline-block"
            >
              ← Back to Patients
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{patientData.full_name}</h1>
            <p className="mt-2 text-gray-600">Patient ID: {patientData.patient_uid}</p>
            {accessStatus?.status === "approved" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-600">Access expires in:</span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  {getAccessTimer()}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? "text-teal-600 border-b-2 border-teal-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Age</p>
                      <p className="text-lg font-semibold text-gray-900">{calculateAge(patientData.date_of_birth)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Gender</p>
                      <p className="text-lg font-semibold text-gray-900">{patientData.gender || "N/A"}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Blood Group</p>
                      <p className="text-lg font-semibold text-gray-900">{patientData.blood_group || "N/A"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Height</p>
                      <p className="text-lg font-semibold text-gray-900">{patientData.height ? `${patientData.height} cm` : "N/A"}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Weight</p>
                      <p className="text-lg font-semibold text-gray-900">{patientData.weight ? `${patientData.weight} kg` : "N/A"}</p>
                    </div>
                  </div>
                  {patientData.allergies && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-700 mb-2">Allergies</p>
                      <p className="text-red-900">{patientData.allergies}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "medical-records" && (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="search"
                      placeholder="Search medicines, conditions, notes, or OCR text"
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <select
                      value={recordSearchFilter}
                      onChange={(e) => setRecordSearchFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="all">All tags</option>
                      <option value="medicine">Medicine</option>
                      <option value="condition">Condition</option>
                      <option value="ocr">OCR text</option>
                      <option value="type">Record type</option>
                    </select>
                    <button
                      onClick={fetchMedicalRecords}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Search
                    </button>
                  </div>
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No medical records found</div>
                  ) : (
                    <div className="space-y-3">
                      {medicalRecords.map((record) => (
                        <MedicalRecordCard
                          key={record.id}
                          record={record}
                          searchQuery={recordSearch}
                          onView={handleViewRecord}
                          viewing={viewingRecordId === record.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "lab-reports" && (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="search"
                      placeholder="Search lab reports..."
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                      onClick={fetchMedicalRecords}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Search
                    </button>
                  </div>
                  {medicalRecords.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No lab reports found</div>
                  ) : (
                    <div className="space-y-3">
                      {medicalRecords.map((record) => (
                        <MedicalRecordCard
                          key={record.id}
                          record={record}
                          searchQuery={recordSearch}
                          onView={handleViewRecord}
                          viewing={viewingRecordId === record.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "prescription-history" && (
                <div>
                  {prescriptions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No prescriptions found</div>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map((prescription) => (
                        <div key={prescription.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-gray-900">{prescription.prescription_id}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              prescription.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {prescription.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Diagnosis: {prescription.diagnosis}</p>
                          <p className="text-sm text-gray-600">Created: {formatDateTime(prescription.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "create-prescription" && (
                <div>
                  {accessStatus?.status !== "approved" ? (
                    <div className="text-center py-8">
                      <p className="text-red-600 mb-4">You need approved access to create prescriptions for this patient.</p>
                      <button
                        onClick={() => navigate("/doctor/patients")}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Back to Patients
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">Ready to create prescription for {patientData.full_name}</p>
                      <button
                        onClick={() => navigate(`/doctor/prescriptions/create?patientId=${patientData.id}`)}
                        className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
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
