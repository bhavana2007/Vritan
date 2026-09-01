import React from "react";
import Card from "./Card";

export function PageShell({ children, className = "" }) {
  return (
    <div className={`min-h-screen bg-[#F8FAFC] text-slate-900 font-sans ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, align = "left", className = "" }) {
  const alignment = align === "center" ? "mx-auto text-center items-center" : "";

  return (
    <div className={`flex max-w-3xl flex-col gap-3 ${alignment} ${className}`}>
      {eyebrow && (
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-sm font-medium leading-6 text-slate-500 md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}

export function StatTile({ label, value, tone = "blue" }) {
  const toneClass = tone === "emerald" ? "text-green-700" : "text-blue-700";

  return (
    <Card className="p-5">
      <p className={`text-2xl font-black tracking-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </Card>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function DataTable({ columns, rows, emptyText = "No records available." }) {
  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800/80 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || index} className="transition-colors hover:bg-blue-50/70">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-slate-700">
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

export function EnterpriseNavItem({ active, icon, label, onClick, collapsed = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
        active
          ? "border border-blue-200 bg-blue-50 text-blue-800 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      } ${collapsed ? "justify-center" : "gap-3"}`}
    >
      <span className={active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-600"}>{icon}</span>
      {!collapsed && <span className="font-bold">{label}</span>}
    </button>
  );
}
