import React from "react";

function AccessBadge({ status, className = "" }) {
  const statusConfig = {
    none: { label: "No Permission", color: "bg-gray-100 text-gray-800" },
    pending: { label: "Waiting Approval", color: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Approved", color: "bg-green-100 text-green-800" },
    denied: { label: "Denied", color: "bg-red-100 text-red-800" },
    expired: { label: "Expired", color: "bg-gray-100 text-gray-800" },
  };

  const config = statusConfig[status] || statusConfig.none;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color} ${className}`}>
      {config.label}
    </span>
  );
}

export default AccessBadge;
