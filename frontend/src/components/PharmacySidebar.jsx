import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NotificationBell from "./NotificationBell";

function PharmacySidebar({ currentPage }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard & Queue", path: "/pharmacy/dashboard" },
    { id: "manual", label: "Manual Prescription", path: "/pharmacy/manual-entry" },
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
              <p className="text-sm font-semibold text-slate-900">Pharmacy Portal</p>
            </div>
          </div>
          <NotificationBell roleBasePath="/pharmacy" />
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
              <span className="text-lg">{item.id === 'dashboard' ? '💊' : '📝'}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
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

export default PharmacySidebar;
