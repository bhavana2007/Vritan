import React from "react";
import { StatCard } from "./components/StatCard";
import { ChartCard } from "./components/ChartCard";

export function AIAnalyticsPanel() {
  const metrics = [
    { title: "Average OCR Confidence", value: "96.4%", icon: "👁️", color: "emerald", description: "Standard deviation +/- 1.2%" },
    { title: "Extraction Speed", value: "1.4s", icon: "⚡", color: "blue", description: "Average processing latency per page" },
    { title: "Tokens Processed", value: "842K", icon: "🧠", color: "purple", description: "Cumulative token counts this month" },
    { title: "Auto-Match Accuracy", value: "98.9%", icon: "🎯", color: "emerald", description: "Prescription key extraction match rate" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI & Pipeline Analytics</h1>
        <p className="text-xs font-semibold text-slate-500">Monitor OCR precision, LLM token load counts, and pipeline accuracy metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {metrics.map((m, idx) => (
          <StatCard
            key={idx}
            title={m.title}
            value={m.value}
            icon={m.icon}
            color={m.color}
            description={m.description}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard
          title="Confidence Over Time"
          description="Average OCR structured reading confidence percentages"
        >
          <svg className="w-full h-full max-h-48" viewBox="0 0 400 200">
            <line x1="40" y1="20" x2="380" y2="20" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="70" x2="380" y2="70" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="120" x2="380" y2="120" stroke="#f1f5f9" strokeWidth="1" />
            <line x1="40" y1="170" x2="380" y2="170" stroke="#e2e8f0" strokeWidth="1" />
            <path
              d="M 40 50 Q 140 40, 240 45 T 380 30 L 380 170 L 40 170 Z"
              fill="rgba(59, 130, 246, 0.05)"
            />
            <path
              d="M 40 50 Q 140 40, 240 45 T 380 30"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
            />
            <circle cx="380" cy="30" r="5" fill="#3b82f6" />
            <text x="40" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">Mon</text>
            <text x="140" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">Wed</text>
            <text x="240" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">Fri</text>
            <text x="340" y="190" fill="#94a3b8" fontSize="9" fontWeight="bold">Sun</text>
          </svg>
        </ChartCard>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Pipeline Accuracy Logs</h4>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {[
              { id: "TX-4201", type: "Prescription OCR", confidence: "98.2%", status: "Auto-Verified" },
              { id: "TX-4202", type: "Lab Report Scan", confidence: "94.5%", status: "Auto-Verified" },
              { id: "TX-4203", type: "X-Ray Report", confidence: "91.8%", status: "Manual Review Needed" },
            ].map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{log.type}</p>
                  <span className="text-[9px] font-mono text-slate-400">{log.id}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800">{log.confidence}</p>
                  <span className={`text-[9px] font-bold ${log.status.includes("Manual") ? "text-amber-600" : "text-emerald-600"}`}>{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
