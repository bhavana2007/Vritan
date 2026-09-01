import React from "react";

export function StatusBadge({ status }) {
  const normalized = (status || "pending").toUpperCase();

  const styleMap = {
    VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
    SUSPENDED: "bg-slate-100 text-slate-700 border-slate-300",
    PENDING_EMAIL_VERIFICATION: "bg-blue-50 text-blue-700 border-blue-200",
    PENDING_ADMIN_VERIFICATION: "bg-amber-50 text-amber-800 border-amber-200",
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  };

  const textMap = {
    VERIFIED: "Verified",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    SUSPENDED: "Suspended",
    PENDING_EMAIL_VERIFICATION: "Email Verification Pending",
    PENDING_ADMIN_VERIFICATION: "Admin Review Pending",
    PENDING: "Pending",
  };

  return (
    <span className={`px-2.5 py-0.5 font-mono text-[10px] font-bold rounded border ${styleMap[normalized] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
      {textMap[normalized] || status}
    </span>
  );
}
