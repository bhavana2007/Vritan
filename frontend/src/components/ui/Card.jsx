import React from "react";

export function Card({
  children,
  className = "",
  onClick,
  hoverEffect = false,
  ...props
}) {
  const baseStyles = "bg-white border border-slate-200 rounded-2xl shadow-[0_14px_34px_-26px_rgba(15,23,42,0.22)] overflow-hidden text-slate-900";
  const hoverStyles = hoverEffect ? "hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200" : "";
  const cursorStyles = onClick ? "cursor-pointer" : "";

  return (
    <div
      onClick={onClick}
      className={`${baseStyles} ${hoverStyles} ${cursorStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
export default Card;
