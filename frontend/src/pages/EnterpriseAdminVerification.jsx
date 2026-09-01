import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

function EnterpriseAdminVerification() {
  const [activeTab, setActiveTab] = useState("hospitals"); // 'hospitals', 'pharmacies', 'government', 'doctors', 'audit'
  const [pendingData, setPendingData] = useState({
    hospitals: [],
    pharmacies: [],
    government_authorities: [],
    doctors: [],
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionReason, setActionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, logsRes] = await Promise.all([
        apiClient.get("/admin/organizations/pending").catch(() => ({ hospitals: [], pharmacies: [], government_authorities: [], doctors: [] })),
        apiClient.get("/admin/audit-logs").catch(() => []),
      ]);
      setPendingData(pendingRes || { hospitals: [], pharmacies: [], government_authorities: [], doctors: [] });
      setAuditLogs(Array.isArray(logsRes) ? logsRes : []);
    } catch (err) {
      console.error("Admin Verification Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOrgAction = async (orgType, orgId, action) => {
    setProcessingId(`${orgType}-${orgId}`);
    try {
      await apiClient.post(`/admin/organizations/${orgType}/${orgId}/action`, {
        action,
        reason: actionReason || "Verified by Super Admin"
      });
      setActionReason("");
      await fetchData();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Admin Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Super Admin Enterprise Verification Dashboard
              </h1>
              <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-mono font-bold rounded border border-purple-200">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Review multi-role organization registrations, inspect uploaded license documents, assign permanent Vritan IDs, and track audit logs.
            </p>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2 overflow-x-auto">
            {[
              { id: "hospitals", label: `Hospitals (${pendingData.hospitals?.length || 0})` },
              { id: "pharmacies", label: `Pharmacies (${pendingData.pharmacies?.length || 0})` },
              { id: "government", label: `Government Authorities (${pendingData.government_authorities?.length || 0})` },
              { id: "doctors", label: `Doctors (${pendingData.doctors?.length || 0})` },
              { id: "audit", label: "Enterprise Audit Logs" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-emerald-700 border-t-2 border-t-emerald-600 border-x border-slate-200 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-xs text-slate-500 mt-2">Loading organization verification records...</p>
              </div>
            ) : activeTab === "audit" ? (
              /* Audit Log View */
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                    <tr>
                      <th className="p-3.5">Event ID</th>
                      <th className="p-3.5">Event Type</th>
                      <th className="p-3.5">Entity</th>
                      <th className="p-3.5">Action Details</th>
                      <th className="p-3.5">IP Address</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-mono text-xs font-bold text-slate-600">{log.event_id || log.id}</td>
                        <td className="p-3.5 font-bold text-slate-900">{log.event_type}</td>
                        <td className="p-3.5 text-xs text-slate-600">{log.entity_type} #{log.entity_id}</td>
                        <td className="p-3.5 text-xs text-slate-800 font-medium">{log.action}</td>
                        <td className="p-3.5 text-xs font-mono text-slate-500">{log.ip_address}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-xs">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Organization List View */
              <div className="space-y-4">
                {((activeTab === "hospitals" ? pendingData.hospitals :
                  activeTab === "pharmacies" ? pendingData.pharmacies :
                  activeTab === "government" ? pendingData.government_authorities :
                  pendingData.doctors) || []).map((item) => (
                  <div key={item.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{item.name || item.agency_name}</h3>
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs font-bold rounded border border-blue-200">
                          {item.vritan_id || "VR-PENDING"}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-full border border-amber-200">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">Email: <span className="font-semibold">{item.email}</span> • Registration #: <span className="font-mono font-bold">{item.reg_number || item.drug_license || item.license || "N/A"}</span></p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        onClick={() => handleOrgAction(activeTab.slice(0, -1), item.id, "APPROVE")}
                        disabled={processingId === `${activeTab.slice(0, -1)}-${item.id}`}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                      >
                        Approve & Assign Vritan ID
                      </button>
                      <button
                        onClick={() => handleOrgAction(activeTab.slice(0, -1), item.id, "REJECT")}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleOrgAction(activeTab.slice(0, -1), item.id, "SUSPEND")}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnterpriseAdminVerification;
