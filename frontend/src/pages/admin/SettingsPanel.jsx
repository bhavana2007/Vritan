import React, { useState } from "react";

export function SettingsPanel() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rateLimit, setRateLimit] = useState(60);
  const [backupSchedule, setBackupSchedule] = useState("Daily");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setMessage("System configuration updated successfully.");
      setTimeout(() => setMessage(""), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-xs font-semibold text-slate-500">Configure global throttling limits, data security protocols, and maintenance schedules.</p>
      </div>

      {message && <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl">{message}</div>}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Maintenance Mode</h4>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Throttles patient and doctor traffic; displays offline status banner.</p>
          </div>
          <button
            onClick={() => setMaintenanceMode(!maintenanceMode)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${maintenanceMode ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"}`}
          >
            <span className="w-4 h-4 bg-white rounded-full shadow-sm"></span>
          </button>
        </div>

        {/* Input Throttling */}
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">API Rate Throttling Limit</label>
          <p className="text-[11px] text-slate-400 font-medium mb-1">Max HTTP requests allowed per unique IP address token per minute.</p>
          <input
            type="number"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
            className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Dropdown Select */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Automated Backup Frequency</label>
          <p className="text-[11px] text-slate-400 font-medium mb-1">Backup cadence for MySQL tables and media upload targets.</p>
          <select
            value={backupSchedule}
            onChange={(e) => setBackupSchedule(e.target.value)}
            className="w-full max-w-xs px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
          >
            <option value="Hourly">Hourly</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          {saving ? "Saving Changes..." : "Save System Config"}
        </button>
      </div>
    </div>
  );
}
