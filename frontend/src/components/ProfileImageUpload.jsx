import { useState, useRef } from "react";
import api from "../services/api";

function ProfileImageUpload({ currentImageUrl, onImageUploaded, role }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const fallbackInitial = role === "patient" ? "P" : role === "doctor" ? "D" : "L";

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG).");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/profile/upload-image", formData);
      if (onImageUploaded) {
        onImageUploaded(response.data.profile_image_url);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative group">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-200 border-4 border-white shadow-md flex items-center justify-center">
          {currentImageUrl ? (
            <img 
              src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${currentImageUrl}`} 
              alt="Profile" 
              className="w-full h-full object-cover" 
            />
          ) : (
            <span className="text-3xl text-slate-400 font-bold">{fallbackInitial}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors focus:outline-none"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/jpeg, image/png, image/jpg"
        className="hidden"
      />
      
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

export default ProfileImageUpload;
