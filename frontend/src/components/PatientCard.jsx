import React from "react";
import CountdownTimer from "./CountdownTimer";
import AccessBadge from "./AccessBadge";

function PatientCard({ patient, accessStatus, onOpenRecord, onCreatePrescription, onRequestAccess }) {
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{patient.full_name}</h3>
          <p className="text-sm text-gray-600 mt-1">ID: {patient.patient_uid}</p>
        </div>
        {accessStatus && <AccessBadge status={accessStatus.status} />}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-500">Age</p>
          <p className="text-sm font-medium text-gray-900">{calculateAge(patient.date_of_birth)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Gender</p>
          <p className="text-sm font-medium text-gray-900">{patient.gender || "N/A"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Blood Group</p>
          <p className="text-sm font-medium text-gray-900">{patient.blood_group || "N/A"}</p>
        </div>
        {accessStatus?.expires_at && (
          <div>
            <p className="text-xs text-gray-500">Access Expires</p>
            <CountdownTimer expiresAt={accessStatus.expires_at} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {accessStatus?.status === "approved" ? (
          <>
            <button
              onClick={onOpenRecord}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              Open Record
            </button>
            <button
              onClick={onCreatePrescription}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Create Prescription
            </button>
          </>
        ) : accessStatus?.status === "none" || accessStatus?.status === "denied" || accessStatus?.status === "expired" ? (
          <button
            onClick={onRequestAccess}
            className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
          >
            Request Access
          </button>
        ) : (
          <button
            disabled
            className="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
          >
            Waiting for Approval
          </button>
        )}
      </div>
    </div>
  );
}

export default PatientCard;
