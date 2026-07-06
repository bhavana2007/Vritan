import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorPatients() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [patientUid, setPatientUid] = useState("");
  const [patientResult, setPatientResult] = useState(null);
  const [accessStatus, setAccessStatus] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const checkAccessStatus = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(uid)}/access-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setAccessStatus(data);
    } catch (err) {
      setAccessStatus(null);
    }
  }, [token]);

  async function handlePatientSearch(e) {
    e.preventDefault();
    const uid = patientUid.trim();
    if (!uid) {
      setSearchMessage("Please enter a Patient ID.");
      setPatientResult(null);
      setAccessStatus(null);
      return;
    }

    setSearching(true);
    setSearchMessage("");
    setPatientResult(null);
    setAccessStatus(null);

    try {
      const response = await fetch(
        `${API_BASE}/doctor/patient/${encodeURIComponent(uid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPatientResult(data);
      await checkAccessStatus(uid);
    } catch (error) {
      setSearchMessage(
        error instanceof Error ? error.message : "Could not search patient.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleRequestAccess() {
    if (!patientResult?.patient_uid) return;
    setRequesting(true);

    try {
      const response = await fetch(
        `${API_BASE}/doctor/request-access/${encodeURIComponent(
          patientResult.patient_uid,
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      await checkAccessStatus(patientResult.patient_uid);
    } catch (error) {
      setSearchMessage(
        error instanceof Error
          ? error.message
          : "Could not create access request.",
      );
    } finally {
      setRequesting(false);
    }
  }

  function handleOpenPatientRecord() {
    if (patientResult && accessStatus?.status === "approved") {
      navigate(`/doctor/patient/${patientResult.patient_uid}`);
    }
  }

  function getStatusBadge(status) {
    const statusConfig = {
      none: { label: "No Permission", color: "bg-gray-100 text-gray-800" },
      pending: { label: "Waiting Approval", color: "bg-yellow-100 text-yellow-800" },
      approved: { label: "Approved", color: "bg-green-100 text-green-800" },
      denied: { label: "Denied", color: "bg-red-100 text-red-800" },
      expired: { label: "Expired", color: "bg-gray-100 text-gray-800" },
    };
    const config = statusConfig[status] || statusConfig.none;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    );
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="patients" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
            <p className="mt-2 text-gray-600">Search for patients and request access to their records.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Patient</h2>
            <form onSubmit={handlePatientSearch} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter Patient ID (e.g., PAT-000123)"
                value={patientUid}
                onChange={(e) => setPatientUid(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchMessage ? (
              <div className={`mt-4 p-4 rounded-lg ${
                searchMessage.includes("not found") || searchMessage.includes("error")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                {searchMessage}
              </div>
            ) : null}
          </div>

          {patientResult ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Patient Profile</h2>
                {accessStatus && getStatusBadge(accessStatus.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Patient Name</p>
                  <p className="text-lg font-semibold text-gray-900">{patientResult.full_name}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Patient ID</p>
                  <p className="text-lg font-semibold text-gray-900">{patientResult.patient_uid}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Age</p>
                  <p className="text-lg font-semibold text-gray-900">{calculateAge(patientResult.date_of_birth)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Gender</p>
                  <p className="text-lg font-semibold text-gray-900">{patientResult.gender || "N/A"}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Blood Group</p>
                  <p className="text-lg font-semibold text-gray-900">{patientResult.blood_group || "N/A"}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                {accessStatus?.status === "none" && (
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting}
                    className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {requesting ? "Requesting..." : "Request Access"}
                  </button>
                )}

                {accessStatus?.status === "pending" && (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Waiting for patient approval...</p>
                    <button
                      onClick={() => checkAccessStatus(patientResult.patient_uid)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Check Status
                    </button>
                  </div>
                )}

                {accessStatus?.status === "approved" && (
                  <button
                    onClick={handleOpenPatientRecord}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Open Patient Record
                  </button>
                )}

                {accessStatus?.status === "denied" && (
                  <div className="text-center">
                    <p className="text-red-600 mb-4">Patient denied this access request.</p>
                    <button
                      onClick={handleRequestAccess}
                      disabled={requesting}
                      className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
                    >
                      {requesting ? "Requesting..." : "Request Access Again"}
                    </button>
                  </div>
                )}

                {accessStatus?.status === "expired" && (
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting}
                    className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {requesting ? "Requesting..." : "Request Access Again"}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default DoctorPatients;
