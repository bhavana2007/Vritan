import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

function DoctorSidebar({ currentPage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const doctorDisplayName = user?.name || user?.email || "Doctor";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", path: "/doctor/dashboard", icon: "📊" },
    { id: "schedule", label: "My Schedule", path: "/doctor/schedule", icon: "🕒" },
    { id: "appointments", label: "Appointments", path: "/doctor/appointments", icon: "📅" },
    { id: "patients", label: "Patients", path: "/doctor/patients", icon: "👥" },
    { id: "prescriptions", label: "Prescriptions", path: "/doctor/prescriptions", icon: "📋" },
    { id: "analytics", label: "Analytics", path: "/doctor/analytics", icon: "📈" },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 text-slate-700">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Vritan" className="h-9 w-9 object-contain" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Vritan EHR
            </p>
            <p className="text-sm font-extrabold text-slate-900">Doctor Portal</p>
          </div>
        </div>
        <NotificationBell roleBasePath="/doctor" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id || location.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3.5 text-sm ${
                isActive
                  ? "bg-blue-50 text-blue-800 font-bold border border-blue-200 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold overflow-hidden border border-blue-200">
            {user?.profile_image_url ? (
              <img src={`http://localhost:8000${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              doctorDisplayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-slate-900 truncate">{doctorDisplayName}</p>
            <p className="text-[11px] text-slate-500 truncate font-medium">Verified Clinician</p>
          </div>
        </div>
        
        <div className="space-y-1">
          <button
            onClick={() => {
              navigate("/doctor/profile");
              setMobileOpen(false);
            }}
            className="w-full px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all text-left flex items-center gap-2"
          >
            <span>👤</span> Profile
          </button>
          <button
            onClick={() => {
              navigate("/doctor/settings");
              setMobileOpen(false);
            }}
            className="w-full px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all text-left flex items-center gap-2"
          >
            <span>⚙️</span> Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all text-left flex items-center gap-2 mt-1"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation Bar (< lg screens) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-30 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xl">☰</span>
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Vritan" className="h-7 w-7 object-contain" />
            <span className="font-bold text-slate-900 text-sm">VRITAN Doctor Portal</span>
          </div>
        </div>
        <NotificationBell roleBasePath="/doctor" />
      </div>

      {/* Desktop In-Flow Sidebar (>= lg screens): Width 320px (w-80), sticky, in flex flow */}
      <aside className="hidden lg:flex w-72 lg:w-80 flex-shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Off-Canvas Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full h-full shadow-2xl z-10">
            <button
              onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 text-lg font-bold"
            >
              ✕
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default DoctorSidebar;
