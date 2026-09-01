import React from "react";

export function SystemHealthPanel({ health }) {
  const getStatusIndicator = (status) => {
    switch (status) {
      case "healthy":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 rounded-lg text-[10px]">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Active
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 font-bold border border-amber-100 rounded-lg text-[10px]">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Latency Warning
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 font-bold border border-rose-100 rounded-lg text-[10px]">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            Critical Offline
          </span>
        );
    }
  };

  const services = [
    { name: "MySQL Relational Database", description: "Storage for user profiles, credentials, and transactions", key: "database", host: "localhost:3307" },
    { name: "Firebase Phone Authentication", description: "SMS gateway verification and token security authentication", key: "firebase", host: "firebase.googleapis.com" },
    { name: "Google Gemini Large Language Model", description: "Structured record parsing and medical diagnostic summaries", key: "gemini", host: "generativelanguage.googleapis.com" },
    { name: "OCR Processing Pipeline", description: "Local Tesseract file parser engine", key: "ocr", host: "vritan-ocr:5000" },
    { name: "SMTP Email Service", description: "Gmail transactional email delivery (smtp.gmail.com:587)", key: "email", host: "smtp.gmail.com" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Infrastructure Health</h1>
        <p className="text-xs font-semibold text-slate-500">Live operational status, queue congestion metrics, and network gateway connectivity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">OCR Background Job Queue</p>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{health.queueLength} tasks</h3>
          <span className="text-[9px] font-bold text-emerald-600 uppercase mt-1 block">Queue clear</span>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Storage Volume Consumed</p>
          <h3 className="text-2xl font-black text-slate-900 mt-2">{health.storageUsage}</h3>
          <span className="text-[9px] font-bold text-slate-400 mt-1 block">Capacity: 10 GB</span>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Average Server Latency</p>
          <h3 className="text-2xl font-black text-slate-900 mt-2">184 ms</h3>
          <span className="text-[9px] font-bold text-emerald-600 uppercase mt-1 block">Standard Response Time</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Services Index</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {services.map((svc) => (
            <div key={svc.key} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">{svc.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{svc.description}</p>
                <span className="text-[10px] font-mono text-slate-500 mt-1 block font-semibold">{svc.host}</span>
              </div>
              <div className="shrink-0 flex items-center">
                {getStatusIndicator(health[svc.key])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
