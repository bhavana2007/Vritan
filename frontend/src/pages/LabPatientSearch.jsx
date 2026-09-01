import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import LabSidebar from "../components/LabSidebar";

function LabPatientSearch() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const response = await fetch(
        `${API_BASE}/lab/patient-search?q=${encodeURIComponent(query.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json().catch(() => ([]));
      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Patient search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <LabSidebar currentPage="patients" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Search Patient</h1>
            <p className="mt-2 text-slate-600">Locate and verify a patient's identity prior to uploading diagnostic reports.</p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
            <form onSubmit={handleSearch} className="flex gap-4">
              <input
                type="text"
                placeholder="Search by Patient UID, Mobile, or Full Name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-slate-950 font-medium"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-400"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </form>
            <p className="mt-3 text-xs text-slate-400">
              * Verification parameters return only limited identity fields to preserve patient privacy.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Results Section */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Search Results</h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              </div>
            ) : patients.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold uppercase">
                          {patient.patient_uid}
                        </span>
                        <span className="text-xs text-slate-500">Gender: {patient.gender || "N/A"}</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{patient.full_name}</h3>
                      <p className="text-sm text-slate-500 mb-4">Age: {patient.age ? `${patient.age} years` : "N/A"}</p>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">{patient.mobile}</span>
                      <button
                        onClick={() => navigate(`/lab/upload?patientId=${patient.id}`)}
                        className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors text-sm font-medium"
                      >
                        Verify & Upload Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searched ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                No patient matched your query. Please check spelling or phone number.
              </div>
            ) : (
              <div className="bg-slate-100 border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 font-medium">
                Enter a query above to search patients.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default LabPatientSearch;
