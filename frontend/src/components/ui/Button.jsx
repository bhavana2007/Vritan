import React from "react";

export function Button({
  children,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  variant = "primary",
  size = "md", // sm, md, lg
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-bold tracking-tight rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  
  const variants = {
    primary: "bg-green-600 text-white hover:bg-green-700 shadow-[0_12px_28px_-20px_rgba(22,163,74,0.7)]",
    secondary: "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300",
    outline: "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300",
    text: "bg-transparent text-blue-700 hover:bg-blue-50",
  };

  const sizes = {
    sm: "px-3.5 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export default Button;
