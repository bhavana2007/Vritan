import { useEffect, useState } from "react";
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import LabSidebar from "../components/LabSidebar";

function LabUploadHistory() {
  const { token } = useAuth();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchHistory() {
      if (!token) return;
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/lab/upload-history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ([]));
        if (!response.ok) {
          throw new Error(parseFastApiDetail(data));
        }
        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load upload history");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [token]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <LabSidebar currentPage="history" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Upload History</h1>
            <p className="mt-2 text-slate-600">A historical audit log of all diagnostic reports uploaded by your laboratory.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* History Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              </div>
            ) : history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-sm font-medium">
                      <th className="py-4 px-2">Report Name</th>
                      <th className="py-4 px-2">Diagnostic Type</th>
                      <th className="py-4 px-2">Upload Date</th>
                      <th className="py-4 px-2">Verification Status</th>
                      <th className="py-4 px-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-2 font-medium text-slate-900">{record.original_filename}</td>
                        <td className="py-4 px-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold uppercase">
                            {record.document_type || "Report"}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-slate-500 text-sm">
                          {new Date(record.uploaded_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            record.verification_status === "verified"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {record.verification_status === "verified" ? "Verified" : "Pending"}
                          </span>
                        </td>
                        <td className="py-4 px-2">
                          <a
                            href={`${API_BASE}${record.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-600 font-semibold text-sm hover:underline"
                          >
                            View Document
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No laboratory reports uploaded yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default LabUploadHistory;
