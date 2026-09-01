import React from "react";

export function Sidebar({ activeTab, setActiveTab, role = "SUPER_ADMIN", user, onLogout }) {
  const roleMenus = {
    SUPER_ADMIN: [
      { id: "dashboard", label: "Overview Dashboard", icon: "📊" },
      { id: "verification", label: "Verification Center", icon: "🛡️" },
      { id: "directories", label: "Stakeholders Index", icon: "👥" },
      { id: "ai_analytics", label: "AI Analytics Logs", icon: "🤖" },
      { id: "health", label: "System Health Info", icon: "⚡" },
      { id: "audit_logs", label: "Security Audit Logs", icon: "📜" },
      { id: "settings", label: "System Settings", icon: "⚙️" },
    ],
  };

  const menuItems = roleMenus[role] || roleMenus.SUPER_ADMIN;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 font-sans text-slate-700">
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <img src="/logo.png" alt="Vritan" className="h-9 w-9 object-contain" />
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-wide leading-none">VRITAN Core</h2>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Super Portal</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === item.id
                ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-5 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 truncate">Administrator</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email || "admin@vritan.com"}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full py-2 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-xs font-bold rounded-xl border border-slate-200 transition-all text-slate-600"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
