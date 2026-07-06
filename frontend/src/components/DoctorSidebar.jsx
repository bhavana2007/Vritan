import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function DoctorSidebar({ currentPage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();

  const doctorDisplayName = user?.name || user?.email || "Doctor";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", path: "/doctor/dashboard" },
    { id: "patients", label: "Patients", path: "/doctor/patients" },
    { id: "prescriptions", label: "Prescriptions", path: "/doctor/prescriptions" },
    { id: "analytics", label: "Analytics", path: "/doctor/analytics" },
    { id: "profile", label: "Profile", path: "/doctor/profile" },
    { id: "settings", label: "Settings", path: "/doctor/settings" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-cyan-100 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-cyan-100">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MediLocker" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              MediLocker
            </p>
            <p className="text-sm font-semibold med-title">Doctor Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id || location.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${
                isActive
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-lg">{getIconForItem(item.id)}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-cyan-100">
        <div className="mb-4 px-4">
          <p className="text-sm font-semibold med-title text-gray-900">{doctorDisplayName}</p>
          <p className="text-xs text-gray-500">Verified Doctor</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all duration-200 flex items-center gap-3"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function getIconForItem(id) {
  const icons = {
    dashboard: "📊",
    patients: "👥",
    prescriptions: "📋",
    analytics: "📈",
    profile: "👤",
    settings: "⚙️",
  };
  return icons[id] || "📄";
}

export default DoctorSidebar;
