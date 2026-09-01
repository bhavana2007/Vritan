import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import LabSidebar from "../components/LabSidebar";

function LabDashboard() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      if (!token) return;
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/lab/dashboard-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load stats");
        if (err instanceof Error && err.message.includes("401")) {
          logout();
          navigate("/");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [token, logout, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <LabSidebar currentPage="dashboard" />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <LabSidebar currentPage="dashboard" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Diagnostics Dashboard</h1>
              <p className="mt-2 text-slate-600">Secure Laboratory Report Uploading & AI Auditing Hub</p>
            </div>
            <button
              onClick={() => navigate("/lab/patients")}
              className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 hover:scale-[1.02] active:scale-[0.98] transition-all font-medium shadow-sm flex items-center gap-2"
            >
              <span>+</span> Upload Diagnostic Report
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <p className="text-sm font-medium text-slate-500 uppercase">Today's Uploads</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.today_uploads ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <p className="text-sm font-medium text-slate-500 uppercase">Pending Review</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{stats?.pending_ai ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <p className="text-sm font-medium text-slate-500 uppercase">Total Uploads</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_uploads ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <p className="text-sm font-medium text-slate-500 uppercase">Patients Served</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.patients_served ?? 0}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <p className="text-sm font-medium text-slate-500 uppercase">AI Success Rate</p>
              <p className="text-3xl font-bold text-teal-600 mt-2">{stats?.success_rate ?? 100}%</p>
            </div>
          </div>

          {/* Recent Uploads Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Diagnostic Uploads</h2>
            {stats?.recent_uploads && stats.recent_uploads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-sm font-medium">
                      <th className="py-4 px-2">Report Name</th>
                      <th className="py-4 px-2">Report Type</th>
                      <th className="py-4 px-2">Date Uploaded</th>
                      <th className="py-4 px-2">AI Summary</th>
                      <th className="py-4 px-2">Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_uploads.map((report) => (
                      <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2 font-medium text-slate-900">{report.original_filename}</td>
                        <td className="py-4 px-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold uppercase">
                            {report.document_type || "Report"}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-slate-500 text-sm">
                          {new Date(report.uploaded_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-2 text-slate-600 max-w-xs truncate text-sm">
                          {report.ai_summary || "Processing..."}
                        </td>
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            report.verification_status === "verified"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {report.verification_status === "verified" ? "Verified" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500 text-lg">No diagnostic reports uploaded yet.</p>
                <button
                  onClick={() => navigate("/lab/patients")}
                  className="mt-4 px-4 py-2 text-teal-600 border border-teal-600 rounded-xl hover:bg-teal-50 transition-colors"
                >
                  Upload First Report
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default LabDashboard;
