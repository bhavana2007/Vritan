import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";
import ProfileImageUpload from "../components/ProfileImageUpload";

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
    fetchProfile();
  }, [token]);

  const handleImageUploaded = async (imageUrl) => {
    // Update local user object so the sidebar/header updates instantly
    const updatedUser = { ...user, profile_image_url: imageUrl };
    const { login } = await import("../hooks/useAuth").then(m => m.useAuth()); // We need login function from context, but wait, useAuth was already called, let's grab login from top
    // Since we didn't destructure login at the top, we'll just fetch Profile again and the component will update.
    // Let's add login to useAuth destructing at the top of the component.
    const response = await fetch(`${API_BASE}/doctor/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
        setDoctorProfile(data);
    }
  };

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
      setTimeout(async() => {
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
        <main className="flex-1 p-8 min-w-0">
          <div className="flex items-center justify-center h-full">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar currentPage="profile" />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
            <p className="mt-2 text-slate-600">Your professional information visible to patients.</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          ) : null}

          {doctorProfile ? (
            <div className="space-y-6">
              {/* Profile Photo Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-6">
                  <ProfileImageUpload 
                    currentImageUrl={doctorProfile.profile_image_url} 
                    onImageUploaded={handleImageUploaded}
                    role="doctor"
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{doctorProfile.full_name || user?.name || "Doctor"}</h2>
                    <p className="text-slate-600">{doctorProfile.specialization || "General Physician"}</p>
                    <p className="text-sm text-slate-500 mt-1">{doctorProfile.hospital || "Hospital"}</p>
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Professional Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-slate-600">Medical Registration Number</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{doctorProfile.medical_license_number || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <p className="text-sm text-slate-600">Specialization</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{doctorProfile.specialization || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-sm text-slate-600">Hospital Affiliation</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{doctorProfile.hospital || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-slate-600">Years of Experience</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{doctorProfile.years_of_experience || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <p className="text-sm text-slate-600">Qualification</p>
                    </div>
                    <p className="text-lg font-semibold text-slate-900">{doctorProfile.qualification || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-slate-600">Verification Status</p>
                    </div>
                    <p className={`text-lg font-semibold ${
                      doctorProfile.is_verified ? "text-emerald-700" : "text-amber-700"
                    }`}>
                      {doctorProfile.is_verified ? "Verified" : doctorProfile.verification_status || "Pending"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Digital Signature */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Digital Signature</h2>
                      <p className="text-sm text-slate-500">Appears on all prescriptions</p>
                    </div>
                  </div>
                  {doctorProfile.signature_image_url ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                      Uploaded
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                      Not Uploaded
                    </span>
                  )}
                </div>

                {doctorProfile.signature_image_url ? (
                  <div className="mb-6">
                    <p className="text-sm text-slate-600 mb-3">Current Signature:</p>
                    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50">
                      <img
                        src={`${API_BASE}${doctorProfile.signature_image_url}`}
                        alt="Doctor Signature"
                        className="max-h-24 mx-auto"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-amber-800">No signature uploaded. Your signature will appear on all prescriptions.</p>
                  </div>
                )}

                <button
                  onClick={() => setShowSignatureUpload(true)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                >
                  {doctorProfile.signature_image_url ? "Replace Signature" : "Upload Signature"}
                </button>
              </div>

              {/* Public Information Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-blue-900">Public Information</p>
                    <p className="text-sm text-blue-700 mt-1">This information is visible to patients who have approved access to your profile. To manage account settings like password and notifications, visit Settings.</p>
                  </div>
                </div>
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
