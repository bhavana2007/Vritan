import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

function OrgAdminSidebar({ currentPage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", path: "/org-admin/dashboard", icon: "🏢" },
    { id: "doctors", label: "Doctors", path: "/org-admin/doctors", icon: "🩺" },
    { id: "departments", label: "Departments", path: "/org-admin/departments", icon: "📂" },
    { id: "branches", label: "Branches", path: "/org-admin/branches", icon: "📍" },
    { id: "appointments", label: "Appointments", path: "/org-admin/appointments", icon: "📅" },
    { id: "patients", label: "Patients", path: "/org-admin/patients", icon: "👤" },
    { id: "laboratories", label: "Laboratories", path: "/org-admin/laboratories", icon: "🧪" },
    { id: "pharmacy", label: "Pharmacy", path: "/org-admin/pharmacy", icon: "💊" },
    { id: "medical-records", label: "Medical Records", path: "/org-admin/medical-records", icon: "📜" },
    { id: "analytics", label: "Analytics", path: "/org-admin/analytics", icon: "📊" },
    { id: "settings", label: "Settings", path: "/org-admin/settings", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-50 text-slate-700">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Vritan" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Vritan
              </p>
              <p className="text-sm font-bold text-slate-900">Hospital Admin</p>
            </div>
          </div>
          <div className="text-slate-700">
             <NotificationBell roleBasePath="/org-admin" />
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 mt-4">Command Center</p>
        {menuItems.map((item) => {
          const isActive = currentPage === item.id || location.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
                isActive
                  ? "bg-blue-50 text-blue-800 font-semibold border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-lg opacity-80">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold overflow-hidden border border-blue-200">
            {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.name || "Administrator"}</p>
            <p className="text-xs text-slate-500 truncate">Org Admin</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all text-left flex items-center gap-2 mt-2"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}

export default OrgAdminSidebar;
