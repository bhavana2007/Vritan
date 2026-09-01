import React from "react";

export function Badge({
  children,
  variant = "slate", // emerald, blue, indigo, purple, amber, teal, slate, red
  className = "",
  ...props
}) {
  const baseStyles = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border";
  
  const variants = {
    emerald: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant] || variants.slate} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
export default Badge;
