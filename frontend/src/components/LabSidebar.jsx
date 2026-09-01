import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

function LabSidebar({ currentPage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();

  const technicianName = user?.name || "Lab Technician";

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Laboratory Analytics", path: "/lab/dashboard" },
    { id: "orders", label: "Diagnostic Orders", path: "/lab/orders" },
    { id: "collection", label: "Sample Collection", path: "/lab/collection" },
    { id: "queue", label: "Processing Queue", path: "/lab/queue" },
    { id: "results", label: "Result Entry", path: "/lab/results" },
    { id: "upload", label: "Report Upload (Existing)", path: "/lab/upload" },
    { id: "patients", label: "AI Report Audit (Existing)", path: "/lab/patients" },
    { id: "history", label: "Completed Reports", path: "/lab/history" },
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
              <p className="text-sm font-semibold text-slate-900">Laboratory Portal</p>
            </div>
          </div>
          <NotificationBell roleBasePath="/lab" />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
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
              <span className="text-lg">{getIconForItem(item.id)}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold overflow-hidden border border-blue-200">
            {user?.profile_image_url ? (
              <img src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              technicianName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-slate-900 truncate">{technicianName}</p>
            <p className="text-xs text-slate-500 truncate">Verified Technician</p>
          </div>
        </div>
        
        <div className="space-y-1">
          <button
            onClick={() => navigate("/lab/profile")}
            className="w-full px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all text-left flex items-center gap-2"
          >
            <span>👤</span> Profile
          </button>
          <button
            onClick={() => navigate("/lab/settings")}
            className="w-full px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all text-left flex items-center gap-2"
          >
            <span>⚙️</span> Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all text-left flex items-center gap-2 mt-2"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

function getIconForItem(id) {
  const icons = {
    dashboard: "📊",
    orders: "🩺",
    collection: "🧪",
    queue: "⚙️",
    results: "📝",
    upload: "📤",
    patients: "👥",
    history: "📋",
  };
  return icons[id] || "📄";
}

export default LabSidebar;
