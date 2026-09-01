import React from "react";

export function ChartCard({ title, children, description }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
      <div className="mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
        {description && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-1 flex items-center justify-center min-h-48 relative">
        {children}
      </div>
    </div>
  );
}
