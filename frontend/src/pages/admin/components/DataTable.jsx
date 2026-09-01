import React from "react";

export function DataTable({ headers, data, renderRow, emptyMessage = "No records found.", loading = false }) {
  if (loading) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <p className="text-xs text-slate-500 mt-2 font-medium">Fetching record index...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <p className="text-sm text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200 tracking-wider">
          <tr>
            {headers.map((h, idx) => (
              <th key={idx} className="px-5 py-3.5 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, idx) => renderRow(item, idx))}
        </tbody>
      </table>
    </div>
  );
}
