import React from "react";

function StatCard({ title, value, icon, color, description, trend, trendValue }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700 border border-blue-200",
    green: "bg-green-50 text-green-700 border border-green-200",
    yellow: "bg-amber-50 text-amber-700 border border-amber-200",
    teal: "bg-teal-50 text-teal-700 border border-teal-200",
    purple: "bg-blue-50 text-blue-700 border border-blue-200",
    red: "bg-red-50 text-red-700 border border-red-200",
  };

  const selectedColor = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-blue-200 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${selectedColor}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
            <span className="mr-1">{trend === "up" ? "↑" : "↓"}</span>
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {description && (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      )}
    </div>
  );
}

export default StatCard;
