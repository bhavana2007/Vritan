import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import ProfileImageUpload from "../components/ProfileImageUpload";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { usePatientProfile } from "../context/PatientProfileContext";
import { patientApi } from "../api/patient";

function PatientProfile() {
  const { user, login } = useAuth();
  const { profile, loading: contextLoading, error: contextError, refreshProfile } = usePatientProfile();
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    address: "",
    emergency_contact: "",
    aadhaar_number: "",
    insurance_provider: "",
    insurance_policy_number: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        address: profile.address || "",
        emergency_contact: profile.emergency_contact || "",
        aadhaar_number: profile.aadhaar_number || "",
        insurance_provider: profile.insurance_provider || "",
        insurance_policy_number: profile.insurance_policy_number || "",
      });
    }
  }, [profile]);

  const handleImageUploaded = (imageUrl) => {
    const updatedUser = { ...user, profile_image_url: imageUrl };
    login(updatedUser, localStorage.getItem("token"));
    refreshProfile(); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        form.append(key, formData[key]);
      });
      
      await patientApi.updateProfile(form);
      setSuccess("Profile updated successfully");
      setIsEditing(false);
      refreshProfile();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading && !profile) {
    return (
      <div className="animate-fade-in">
          <LoadingSkeleton type="profile" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Patient Profile</h1>
              <p className="text-slate-500 mt-1">Manage your personal information</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-sm"
              >
                Edit Details
              </button>
            )}
          </div>
          
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl font-medium shadow-sm">
              {success}
            </div>
          )}
          
          {(error || contextError) && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl font-medium shadow-sm flex justify-between items-center">
              <span>{error || contextError}</span>
              {contextError && <button onClick={refreshProfile} className="underline text-sm">Retry</button>}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8 border-b border-slate-100 pb-8">
                <ProfileImageUpload 
                  currentImageUrl={profile?.profile_image_url} 
                  onImageUploaded={handleImageUploaded}
                  role="patient"
                />
                
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-3xl font-bold text-slate-900">{profile?.full_name || user?.name}</h2>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Patient ID</p>
                      <p className="font-semibold text-slate-900 mt-1">{profile?.patient_uid || "Not assigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Mobile</p>
                      <p className="font-semibold text-slate-900 mt-1">{profile?.mobile || user?.mobile || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Gender / Blood Group</p>
                      <p className="font-semibold text-slate-900 mt-1">{profile?.gender || 'N/A'} / {profile?.blood_group || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Date of Birth</p>
                      <p className="font-semibold text-slate-900 mt-1">{profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'}) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Emergency Contact</label>
                      <input
                        type="text"
                        value={formData.emergency_contact}
                        onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                        disabled={saving}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="+91 9876543210"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Aadhaar Number</label>
                      <input
                        type="text"
                        value={formData.aadhaar_number}
                        onChange={(e) => setFormData({...formData, aadhaar_number: e.target.value})}
                        disabled={saving}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="1234 5678 9012"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                      <textarea
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        disabled={saving}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                        rows="3"
                        placeholder="Enter full residential address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Insurance Provider</label>
                      <input
                        type="text"
                        value={formData.insurance_provider}
                        onChange={(e) => setFormData({...formData, insurance_provider: e.target.value})}
                        disabled={saving}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="e.g. LIC, Star Health"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Policy Number</label>
                      <input
                        type="text"
                        value={formData.insurance_policy_number}
                        onChange={(e) => setFormData({...formData, insurance_policy_number: e.target.value})}
                        disabled={saving}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="Policy ID"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setIsEditing(false); setError(""); }}
                      disabled={saving}
                      className="px-6 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                        <span>📞</span> Contact Details
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Address</p>
                        <p className="font-medium text-slate-900">{profile?.address || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Emergency Contact</p>
                        <p className="font-medium text-slate-900">{profile?.emergency_contact || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                        <span>🛡️</span> Identity & Insurance
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Aadhaar Number</p>
                        <p className="font-medium text-slate-900">{profile?.aadhaar_number || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Insurance Provider</p>
                        <p className="font-medium text-slate-900">{profile?.insurance_provider || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Policy Number</p>
                        <p className="font-medium text-slate-900">{profile?.insurance_policy_number || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}

export default PatientProfile;
