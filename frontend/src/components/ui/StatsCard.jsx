import React from "react";
import Card from "./Card";

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  className = "",
  loading = false,
  ...props
}) {
  return (
    <Card className={`p-6 ${className}`} hoverEffect={true} {...props}>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {loading ? (
              <span className="inline-block animate-pulse bg-slate-200 h-9 w-20 rounded-lg" />
            ) : (
              value
            )}
          </h3>
        </div>
        {Icon && (
          <div className="p-3 bg-green-50 text-green-700 rounded-xl border border-green-200">
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>
        )}
      </div>
      {description && !loading && (
        <p className="text-xs text-slate-400 mt-4 font-medium">
          {description}
        </p>
      )}
    </Card>
  );
}
export default StatsCard;
