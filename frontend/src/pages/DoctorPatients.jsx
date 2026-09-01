import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorPatients() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("all"); // 'all', 'today', 'pending', 'recent'
  const [searchMode, setSearchMode] = useState("id"); // 'id', 'name', 'mobile'
  const [searchQuery, setSearchQuery] = useState("");
  const [patientsList, setPatientsList] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchMsg, setSearchMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        // Fetch approved and pending patients
        const [approved, pending] = await Promise.all([
          apiClient.get("/doctor/patients/approved").catch(() => []),
          apiClient.get("/doctor/patients/pending-requests").catch(() => []),
        ]);
        
        const formatPatient = (p, status) => ({
          id: p.id,
          uid: p.patient_uid,
          name: p.patient_name || p.full_name,
          gender: p.gender || "Unknown",
          age: p.age || "N/A",
          mobile: p.mobile || "N/A",
          status: status,
          last_visit: p.created_at ? new Date(p.created_at).toLocaleDateString() : "Unknown",
        });

        const formattedApproved = (Array.isArray(approved) ? approved : []).map(p => formatPatient(p, "Approved Access"));
        const formattedPending = (Array.isArray(pending) ? pending : []).map(p => formatPatient(p, "Pending Consent"));
        
        setPatientsList([...formattedApproved, ...formattedPending]);
      } catch (err) {
        console.error("Failed to load patients:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchPatients();
    }
  }, [token]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchMsg("");
    setSearchResult(null);

    try {
      // API call to search patient by ID/Name/Mobile
      let queryUrl = `/doctor/patient-search?query=${encodeURIComponent(searchQuery)}`;
      // backend /doctor/patient-search only takes query and limit
      const data = await apiClient.get(queryUrl);
      
      if (Array.isArray(data) && data.length > 0) {
        setSearchResult(data[0]); // Just pick the first match for the UI card
      } else {
        setSearchMsg("No matching patient record found.");
      }
    } catch (err) {
      setSearchMsg("No matching patient record found.");
    } finally {
      setSearching(false);
    }
  };

  const filteredPatients = patientsList.filter((p) => {
    if (activeTab === "today") return p.last_visit === "Today";
    if (activeTab === "pending") return p.status === "Pending Consent";
    if (activeTab === "recent") return p.last_visit !== "Today";
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      <DoctorSidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Patient Directory & Access Control
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Lookup medical records, view active patients, and request data-sharing consent.
              </p>
            </div>
          </div>

          {/* Search Bar with Mode Selector */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span>🔍</span> Patient Search Directory
            </h2>

            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 sm:w-48"
              >
                <option value="id">Search by Patient ID</option>
                <option value="name">Search by Full Name</option>
                <option value="mobile">Search by Mobile Number</option>
              </select>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchMode === "id" ? "e.g. VRN-001042" :
                  searchMode === "name" ? "e.g. John Doe" : "e.g. 9876543210"
                }
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />

              <button
                type="submit"
                disabled={searching}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search Patient"}
              </button>
            </form>

            {searchMsg && (
              <p className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">{searchMsg}</p>
            )}

            {searchResult && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{searchResult.name} ({searchResult.uid})</h4>
                  <p className="text-xs text-slate-600">{searchResult.gender} • {searchResult.age} Yrs • Mobile: {searchResult.mobile}</p>
                </div>
                <button
                  onClick={() => navigate(`/doctor/patient/${searchResult.uid}`)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  View Medical Record &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Directory Tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
              {[
                { id: "all", label: "All Directory Patients" },
                { id: "today", label: "Today's Patients" },
                { id: "pending", label: "Pending Consent Requests" },
                { id: "recent", label: "Recently Viewed" },
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

            {/* Patients List Table */}
            <div className="p-6">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                    <tr>
                      <th className="p-3.5">Patient ID</th>
                      <th className="p-3.5">Name</th>
                      <th className="p-3.5">Demographics</th>
                      <th className="p-3.5">Mobile</th>
                      <th className="p-3.5">Consent Status</th>
                      <th className="p-3.5">Last Visit</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-blue-700">{p.uid}</td>
                        <td className="p-3.5 font-bold text-slate-900">{p.name}</td>
                        <td className="p-3.5 text-slate-600 text-xs">{p.gender}, {p.age} Yrs</td>
                        <td className="p-3.5 text-slate-600 font-mono text-xs">{p.mobile}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === "Approved Access" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-orange-50 text-orange-700 border border-orange-200"
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 text-xs font-medium">{p.last_visit}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => navigate(`/doctor/patient/${p.uid}`)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            Open EHR &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DoctorPatients;
