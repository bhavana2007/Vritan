import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_patients: 0,
    prescriptions_today: 0,
    pending_access_requests: 0,
    active_approved_patients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/doctor/dashboard-stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || "Failed to load dashboard stats");
        }
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load dashboard stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [token]);

  const statCards = [
    {
      title: "Total Patients",
      value: stats.total_patients,
      icon: "👥",
      color: "bg-blue-50 text-blue-700",
      description: "Patients you've interacted with",
    },
    {
      title: "Prescriptions Today",
      value: stats.prescriptions_today,
      icon: "📋",
      color: "bg-green-50 text-green-700",
      description: "Prescriptions created today",
    },
    {
      title: "Pending Requests",
      value: stats.pending_access_requests,
      icon: "⏳",
      color: "bg-yellow-50 text-yellow-700",
      description: "Awaiting patient approval",
    },
    {
      title: "Active Patients",
      value: stats.active_approved_patients,
      icon: "✅",
      color: "bg-teal-50 text-teal-700",
      description: "Currently approved access",
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DoctorSidebar currentPage="dashboard" />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            <p className="mt-2 text-gray-600">Welcome back! Here's your practice overview.</p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((card) => (
                  <div
                    key={card.title}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg ${card.color}`}>
                        <span className="text-2xl">{card.icon}</span>
                      </div>
                      <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate("/doctor/patients")}
                      className="w-full text-left px-4 py-3 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">🔍</span>
                      <span>Search Patients</span>
                    </button>
                    <button
                      onClick={() => navigate("/doctor/prescriptions")}
                      className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">📋</span>
                      <span>View Prescriptions</span>
                    </button>
                    <button
                      onClick={() => navigate("/doctor/profile")}
                      className="w-full text-left px-4 py-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium transition-colors flex items-center gap-3"
                    >
                      <span className="text-xl">👤</span>
                      <span>Update Profile</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Analytics Preview</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Monthly Prescription Trend</p>
                      <div className="h-32 flex items-end justify-between gap-2">
                        {[40, 65, 45, 80, 55, 90, 70].map((height, index) => (
                          <div
                            key={index}
                            className="flex-1 bg-teal-500 rounded-t transition-all hover:bg-teal-600"
                            style={{ height: `${height}%` }}
                            title={`Week ${index + 1}`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Week 1</span>
                        <span>Week 7</span>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Recent Activity</p>
                      <p className="text-xs text-gray-500 mt-1">Activity tracking coming soon</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default DoctorDashboard;
