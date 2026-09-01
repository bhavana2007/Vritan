import React from "react";

export function Section({
  children,
  id,
  className = "",
  bg = "base",
  ...props
}) {
  const bgStyles = {
    base: "bg-[#F8FAFC] text-slate-900",
    surface: "bg-white text-slate-900 border-y border-slate-200",
    "navy-dark": "bg-[#F8FAFC] text-slate-900 border-y border-slate-200",
    white: "bg-white text-slate-900",
    "slate-50": "bg-[#F8FAFC] text-slate-900 border-y border-slate-200",
  };

  return (
    <section
      id={id}
      className={`py-10 md:py-16 overflow-hidden ${bgStyles[bg] || bgStyles.white} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
export default Section;
