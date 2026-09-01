import React, { useState } from "react";
import { DataTable } from "./components/DataTable";
import { StatusBadge } from "./components/StatusBadge";
import { SearchBar } from "./components/SearchBar";

export function VerificationPanel({ pendingData, loading, onAction, processingId, onViewDoc }) {
  const [activeTab, setActiveTab] = useState("hospitals"); // 'hospitals' | 'pharmacies' | 'government' | 'doctors' | 'laboratories'
  const [searchTerm, setSearchTerm] = useState("");
  const [actionReason, setActionReason] = useState("");

  const tabConfigs = [
    { id: "hospitals", label: "Hospitals", count: pendingData.hospitals?.length || 0 },
    { id: "pharmacies", label: "Pharmacies", count: pendingData.pharmacies?.length || 0 },
    { id: "government", label: "Gov Authorities", count: pendingData.government_authorities?.length || 0 },
    { id: "doctors", label: "Doctors", count: pendingData.doctors?.length || 0 },
    { id: "laboratories", label: "Laboratories", count: pendingData.laboratories?.length || 0 },
    { id: "branches", label: "Branches", count: pendingData.branches?.length || 0 },
  ];

  const getActiveList = () => {
    return pendingData[activeTab] || [];
  };

  const filteredData = getActiveList().filter((item) => {
    const term = searchTerm.toLowerCase();
    const name = (item.name || item.agency_name || "").toLowerCase();
    const email = (item.email || "").toLowerCase();
    const vritanId = (item.vritan_id || "").toLowerCase();
    return name.includes(term) || email.includes(term) || vritanId.includes(term);
  });

  const getHeaders = () => {
    switch (activeTab) {
      case "hospitals":
        return ["Name / ID", "Email", "Reg Number", "Type", "Status", "Documents", "Actions"];
      case "pharmacies":
        return ["Name / ID", "Email", "Drug License", "Status", "Documents", "Actions"];
      case "government":
        return ["Agency / Officer", "Official Email", "Jurisdiction", "Status", "Documents", "Actions"];
      case "doctors":
        return ["Name", "Email", "License / Hospital", "Status", "Documents", "Actions"];
      case "laboratories":
        return ["Lab Name", "Email", "License", "Status", "Documents", "Actions"];
      case "branches":
        return ["Branch Name", "Email", "Hospital", "Status", "Documents", "Actions"];
      default:
        return [];
    }
  };

  const renderRow = (item, idx) => {
    const isWorking = processingId === `${activeTab.slice(0, -1)}-${item.id}`;
    
    // Quick wrapper to handle action clicks with standard reasons
    const performAction = (action) => {
      onAction(activeTab.slice(0, -1), item.id, action, actionReason || "Verified by Admin");
      setActionReason("");
    };

    switch (activeTab) {
      case "hospitals":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id || "VR-PENDING"}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 font-mono font-bold text-slate-500 text-xs">{item.reg_number || "N/A"}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{item.type}</td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              <div className="flex flex-col gap-1">
                {item.docs?.reg_cert && (
                  <button onClick={() => onViewDoc("hospital", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                    📄 Registration Cert
                  </button>
                )}
                {item.docs?.hospital_license && (
                  <button onClick={() => onViewDoc("hospital", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                    📄 Hospital License
                  </button>
                )}
              </div>
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      case "pharmacies":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id || "VR-PENDING"}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 font-mono font-bold text-slate-500 text-xs">{item.drug_license}</td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              {item.docs?.drug_license && (
                <button onClick={() => onViewDoc("pharmacy", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                  📄 Drug License
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      case "government":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.agency_name}</div>
              <div className="text-xs text-slate-400 font-medium">{item.officer}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id || "VR-PENDING"}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 text-xs font-semibold text-slate-600">{item.jurisdiction}</td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              {item.docs?.gov_id_card && (
                <button onClick={() => onViewDoc("government", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                  📄 Official ID Card
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      case "doctors":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id || "VR-PENDING"}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 text-xs text-slate-600 font-medium">
              <div>{item.license}</div>
              <div className="text-slate-400 mt-0.5">{item.hospital}</div>
            </td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              {item.docs?.verification_doc && (
                <button onClick={() => onViewDoc("doctor", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                  📄 License Attachment
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      case "laboratories":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 font-mono font-bold text-slate-500 text-xs">{item.license}</td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              {item.docs?.verification_doc && (
                <button onClick={() => onViewDoc("lab", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                  📄 Registration Doc
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      case "branches":
        return (
          <tr key={item.id} className="hover:bg-slate-50">
            <td className="px-5 py-4 font-bold text-slate-900">
              <div>{item.name}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.vritan_id || "VR-PENDING"}</div>
            </td>
            <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
            <td className="px-5 py-4 font-mono font-bold text-slate-500 text-xs">{item.organization_name}</td>
            <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4">
              {item.docs?.verification_doc && (
                <button onClick={() => onViewDoc("branch", item.id)} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 text-left">
                  📄 Branch Doc
                </button>
              )}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button disabled={isWorking} onClick={() => performAction("APPROVE")} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-sm">
                  Approve
                </button>
                <button disabled={isWorking} onClick={() => performAction("REJECT")} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-200 text-[10px] rounded-lg">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Verification Center</h1>
        <p className="text-xs font-semibold text-slate-500">Perform background credential evaluations and assign global platform identification values.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200/80 gap-1 overflow-x-auto">
        {tabConfigs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(""); }}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-emerald-600 text-emerald-600 font-extrabold"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder={`Search pending ${activeTab}...`} />
        
        {/* Optional Action Details Input */}
        <input
          type="text"
          placeholder="Optional action rationale comment..."
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          className="w-full max-w-sm px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <DataTable
        headers={getHeaders()}
        data={filteredData}
        renderRow={renderRow}
        loading={loading}
        emptyMessage={`No pending ${activeTab} applications found matching filters.`}
      />
    </div>
  );
}
