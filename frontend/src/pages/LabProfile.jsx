import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import LabSidebar from "../components/LabSidebar";
import ProfileImageUpload from "../components/ProfileImageUpload";

function LabProfile() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    phone: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/lab/me");
      setProfile(response.data);
      setFormData({
        phone: response.data.phone || "",
      });
    } catch (err) {
      setError("Failed to load profile details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUploaded = (imageUrl) => {
    const updatedUser = { ...user, profile_image_url: imageUrl };
    login(updatedUser, localStorage.getItem("token"));
    fetchProfile();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => {
        form.append(key, formData[key]);
      });
      
      await api.put("/profile/lab-tech", form);
      setSuccess("Profile updated successfully");
      setIsEditing(false);
      fetchProfile();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to update profile.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <LabSidebar currentPage="profile" />
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <LabSidebar currentPage="profile" />
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Technician Profile</h1>
              <p className="text-slate-500 mt-1">Manage your laboratory profile details</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium transition-colors"
              >
                Edit Details
              </button>
            )}
          </div>
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
              {success}
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8">
              <div className="flex items-start gap-8 mb-8 border-b border-slate-100 pb-8">
                <ProfileImageUpload 
                  currentImageUrl={profile?.profile_image_url} 
                  onImageUploaded={handleImageUploaded}
                  role="lab_tech"
                />
                
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900">{profile?.full_name}</h2>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Employee ID</p>
                      <p className="font-medium text-slate-900">{profile?.employee_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium text-slate-900">{profile?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Laboratory</p>
                      <p className="font-medium text-slate-900">{profile?.laboratory_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">License Number</p>
                      <p className="font-medium text-slate-900">{profile?.laboratory_license}</p>
                    </div>
                  </div>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Contact Details</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-slate-500">Phone</p>
                        <p className="font-medium text-slate-900">{profile?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Laboratory Address</p>
                        <p className="font-medium text-slate-900">{profile?.laboratory_address || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LabProfile;
