import React from "react";

export function StatCard({ title, value, icon, color = "emerald", description }) {
  const colorMap = {
    emerald: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-red-50 text-red-700 border-red-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between transition-all hover:border-blue-200">
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-extrabold text-slate-900 leading-none">{value}</h3>
        {description && <p className="text-xs font-medium text-slate-400 mt-1">{description}</p>}
      </div>
      <div className={`p-3.5 rounded-xl border ${colorMap[color] || colorMap.emerald}`}>
        {icon}
      </div>
    </div>
  );
}
