import React, { useState } from "react";
import { DataTable } from "./components/DataTable";
import { SearchBar } from "./components/SearchBar";

export function AuditLogsPanel({ auditLogs, loading }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = auditLogs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const eventType = (log.event_type || "").toLowerCase();
    const action = (log.action || "").toLowerCase();
    const entityType = (log.entity_type || "").toLowerCase();
    return eventType.includes(term) || action.includes(term) || entityType.includes(term);
  });

  const renderRow = (log, idx) => (
    <tr key={log.id || idx} className="hover:bg-slate-50">
      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-500">{log.event_id || log.id}</td>
      <td className="px-5 py-4 font-bold text-slate-800 text-xs uppercase tracking-wider">{log.event_type}</td>
      <td className="px-5 py-4 text-xs font-semibold text-slate-700">{log.entity_type} #{log.entity_id}</td>
      <td className="px-5 py-4 text-xs font-medium text-slate-600 max-w-sm break-words">{log.action}</td>
      <td className="px-5 py-4 font-mono text-xs text-slate-400">{log.ip_address}</td>
      <td className="px-5 py-4 text-right">
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[9px] font-bold rounded border border-emerald-100 uppercase">
          {log.status}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Security Audit Logs</h1>
        <p className="text-xs font-semibold text-slate-500">Trace access approvals, administrative decisions, IP footprints, and system actions.</p>
      </div>

      <div className="flex justify-between items-center">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search security audit logs..." />
      </div>

      <DataTable
        headers={["Event ID", "Event Type", "Scope Entity", "Action Rationale Summary", "IP Address", "Status"]}
        data={filteredLogs}
        renderRow={renderRow}
        loading={loading}
        emptyMessage="No matching system event audits recorded."
      />
    </div>
  );
}
