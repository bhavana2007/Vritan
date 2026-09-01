import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

// Modern SVG Icons
const Icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  appointments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  records: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  prescriptions: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  collapse: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  ),
  expand: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  )
};

function PatientSidebar({ currentPage, isCollapsed, onToggleCollapse }) {
  const navigate = useNavigate();
  const { user, logout, activeProfile, profiles, activeProfileId, switchProfile } = useAuth();
  const location = useLocation();

  const patientName = user?.name || "Patient";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: "dashboard" },
    { id: "appointments", label: "Appointments", path: "/dashboard/appointments", icon: "appointments" },
    { id: "records", label: "Medical Records", path: "/dashboard/records", icon: "records" },
    { id: "prescriptions", label: "Prescriptions", path: "/dashboard/prescriptions", icon: "prescriptions" },
  ];

  return (
    <div className="flex flex-col h-full bg-white text-slate-700 relative">
      {/* Header / Logo */}
      <div className={`p-4 border-b border-slate-200 flex items-center transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-50 p-2 rounded-xl flex-shrink-0 border border-blue-100">
            <img src="/logo.png" alt="Vritan" className="h-8 w-8 object-contain" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap animate-fade-in">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Vritan
              </span>
              <span className="text-sm font-semibold text-slate-900">Patient Portal</span>
            </div>
          )}
        </div>
        {!isCollapsed && <NotificationBell roleBasePath="/dashboard" />}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto mt-2">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id || location.pathname === item.path;
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              title={isCollapsed ? item.label : undefined}
              className={`group w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 relative ${
                isActive
                  ? "bg-blue-50 text-blue-800 font-semibold shadow-sm border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              } ${isCollapsed ? 'justify-center' : 'gap-3 text-left'}`}
            >
              {/* Active Indicator Line */}
              {isActive && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-md" />
              )}
              
              <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                {Icons[item.icon]}
              </span>
              
              {!isCollapsed && (
                <span className="whitespace-nowrap flex-1">{item.label}</span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Profile Section */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-1">
        {/* Toggle Collapse Button (Desktop Only) */}
        <button
          onClick={onToggleCollapse}
          className={`hidden lg:flex w-full items-center px-3 py-2 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 transition-colors mb-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isCollapsed ? 'justify-center' : 'gap-3'}`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? Icons.expand : Icons.collapse}
          {!isCollapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>

        {!isCollapsed && (
          <div className="flex flex-col gap-2 px-2 py-2 mb-2 animate-fade-in border border-slate-200 rounded-xl bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 shadow-sm flex items-center justify-center text-blue-700 font-bold overflow-hidden flex-shrink-0">
                {user?.profile_image_url ? (
                  <img src={`http://localhost:8000${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (activeProfile?.full_name || patientName).charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-slate-900 truncate">{activeProfile?.full_name || patientName}</p>
                <p className="text-xs text-slate-500 truncate">Patient Account</p>
              </div>
            </div>
            {/* Profile Switcher dropdown */}
            {profiles && profiles.length > 1 && (
              <select
                value={activeProfileId || ""}
                onChange={(e) => {
                  switchProfile(e.target.value);
                  window.location.reload();
                }}
                className="w-full mt-1 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.relationship || "Self"})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <button
          onClick={() => navigate("/dashboard/profile")}
          aria-label="Profile"
          title={isCollapsed ? "Profile" : undefined}
          className={`group w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            currentPage === 'profile' || location.pathname === '/dashboard/profile'
              ? "bg-blue-50 text-blue-800 font-semibold"
              : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
        >
          <span className={`${currentPage === 'profile' ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'}`}>{Icons.profile}</span>
          {!isCollapsed && <span>Profile</span>}
        </button>
        
        <button
          onClick={() => navigate("/dashboard/settings")}
          aria-label="Settings"
          title={isCollapsed ? "Settings" : undefined}
          className={`group w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            currentPage === 'settings' || location.pathname === '/dashboard/settings'
              ? "bg-blue-50 text-blue-800 font-semibold"
              : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
          } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
        >
          <span className={`${currentPage === 'settings' ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'}`}>{Icons.settings}</span>
          {!isCollapsed && <span>Settings</span>}
        </button>
        
        <button
          onClick={handleLogout}
          aria-label="Logout"
          title={isCollapsed ? "Logout" : undefined}
          className={`group w-full flex items-center px-3 py-2 mt-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${isCollapsed ? 'justify-center' : 'gap-3'}`}
        >
          <span className="text-red-500 group-hover:text-red-600">{Icons.logout}</span>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

export default PatientSidebar;
