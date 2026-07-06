import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorProfile() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSignatureUpload, setShowSignatureUpload] = useState(false);
  const [signatureFile, setSignatureFile] = useState(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/doctor/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        setDoctorProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [token]);

  async function handleSignatureUpload(e) {
    e.preventDefault();
    if (!signatureFile) {
      setSignatureMessage("Please select a signature image");
      return;
    }

    setUploadingSignature(true);
    setSignatureMessage("");

    try {
      const formData = new FormData();
      formData.append("file", signatureFile);

      const response = await fetch(`${API_BASE}/prescriptions/doctor/upload-signature`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setSignatureMessage("Signature uploaded successfully!");
      setSignatureFile(null);
      setTimeout(() => {
        setShowSignatureUpload(false);
        setSignatureMessage("");
        // Refresh profile to get updated signature URL
        const profileResponse = await fetch(`${API_BASE}/doctor/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileResponse.json().catch(() => ({}));
        if (profileResponse.ok) {
          setDoctorProfile(profileData);
        }
      }, 2000);
    } catch (err) {
      setSignatureMessage(err instanceof Error ? err.message : "Could not upload signature");
    } finally {
      setUploadingSignature(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <DoctorSidebar currentPage="profile" />
        <main className="flex-1 ml-64 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="profile" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Profile</h1>
            <p className="mt-2 text-gray-600">Manage your professional information and digital signature.</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          ) : null}

          {doctorProfile ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Full Name</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.full_name || user?.name || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Email</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.email || user?.email || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Phone</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.phone || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Hospital</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.hospital || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Professional Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Registration Number</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.medical_license_number || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Specialization</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.specialization || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Years of Experience</p>
                    <p className="text-lg font-semibold text-gray-900">{doctorProfile.years_of_experience || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Verification Status</p>
                    <p className={`text-lg font-semibold ${
                      doctorProfile.is_verified ? "text-green-700" : "text-yellow-700"
                    }`}>
                      {doctorProfile.is_verified ? "Verified" : doctorProfile.verification_status || "Pending"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Digital Signature</h2>
                  {doctorProfile.signature_image_url ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      Uploaded
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      Not Uploaded
                    </span>
                  )}
                </div>

                {doctorProfile.signature_image_url ? (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-3">Current Signature:</p>
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <img
                        src={`${API_BASE}${doctorProfile.signature_image_url}`}
                        alt="Doctor Signature"
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">No signature uploaded. Your signature will appear on all prescriptions.</p>
                  </div>
                )}

                <button
                  onClick={() => setShowSignatureUpload(true)}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  {doctorProfile.signature_image_url ? "Replace Signature" : "Upload Signature"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {showSignatureUpload ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {doctorProfile?.signature_image_url ? "Replace Signature" : "Upload Signature"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload your signature image. This will appear on all your prescriptions.
            </p>
            <form onSubmit={handleSignatureUpload} className="space-y-4">
              <label className="block w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSignatureFile(e.target.files?.[0])}
                  className="sr-only"
                />
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    {signatureFile ? signatureFile.name : "Click to select signature image"}
                  </p>
                </div>
              </label>
              {signatureFile ? (
                <p className="text-sm text-blue-600">Selected: {signatureFile.name}</p>
              ) : null}
              {signatureMessage ? (
                <p className={`text-sm ${
                  signatureMessage.includes("success") ? "text-green-600" : "text-red-600"
                }`}>
                  {signatureMessage}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSignatureUpload(false);
                    setSignatureFile(null);
                    setSignatureMessage("");
                  }}
                  disabled={uploadingSignature}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingSignature}
                  className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {uploadingSignature ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DoctorProfile;
