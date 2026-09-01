import React from "react";
import { StatCard } from "./components/StatCard";
import { ChartCard } from "./components/ChartCard";

export function DashboardPanel({ stats, onNavigate }) {
  return (
    <div className="space-y-6">
      {/* Upper header summary */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Overview</h1>
        <p className="text-xs font-semibold text-slate-500">Real-time status indexes, diagnostic metrics, and verification actions.</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Active Doctors"
          value={stats.totalDoctors}
          icon="🩺"
          color="emerald"
          description="Verified active practitioners"
        />
        <StatCard
          title="Laboratories"
          value={stats.totalLaboratories}
          icon="🧪"
          color="blue"
          description="Configured diagnostic centers"
        />
        <StatCard
          title="Pending Reviews"
          value={stats.pendingVerifications}
          icon="🛡️"
          color="amber"
          description="Onboarding reviews awaiting action"
        />
        <StatCard
          title="Patients Logged"
          value={stats.activePatients}
          icon="👥"
          color="purple"
          description="Active electronic medical records"
        />
      </div>

      {/* SVG Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Daily API Processing Load"
          description="Requests processed across gateway routers over the last 6 hours"
        >
          <svg className="w-full h-full max-h-48" viewBox="0 0 400 200">
            {/* Grid Lines */}
            <line x1="40" y1="20" x2="380" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="70" x2="380" y2="70" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="120" x2="380" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="170" x2="380" y2="170" stroke="#e2e8f0" strokeWidth="1" />
            {/* Area fill */}
            <path
              d="M 40 170 L 40 120 Q 90 90, 140 110 T 240 60 T 340 50 L 380 40 L 380 170 Z"
              fill="rgba(16, 185, 129, 0.05)"
            />
            {/* Line graph */}
            <path
              d="M 40 120 Q 90 90, 140 110 T 240 60 T 340 50 L 380 40"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
            />
            {/* Highlight dots */}
            <circle cx="380" cy="40" r="5" fill="#10b981" />
            {/* Labels */}
            <text x="40" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">02:00</text>
            <text x="140" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">04:00</text>
            <text x="240" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">06:00</text>
            <text x="340" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">08:00</text>
          </svg>
        </ChartCard>

        <ChartCard
          title="Onboarding Funnel Status"
          description="Verification stage metrics across currently registering stakeholders"
        >
          <div className="w-full flex items-center justify-around gap-2 px-6">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 flex items-center justify-center font-black text-sm text-slate-800">
                48%
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wide">Email Verified</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 flex items-center justify-center font-black text-sm text-slate-800">
                32%
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wide">Admin Review</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center font-black text-sm text-slate-800">
                20%
              </div>
              <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-wide">Fully Setup</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-extrabold text-slate-800">Need to verify new organizations?</h4>
          <p className="text-xs text-slate-500 font-medium mt-0.5">There are pending verification actions requiring review.</p>
        </div>
        <button
          onClick={() => onNavigate("verification")}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          Verify Pending Records →
        </button>
      </div>
    </div>
  );
}
