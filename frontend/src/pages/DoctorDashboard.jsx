import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    today_appointments: 0,
    waiting_queue: 0,
    pending_access_requests: 0,
    active_consultations: 0,
    total_patients: 0,
    prescriptions_today: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!token) return;
      try {
        setLoading(true);
        const [statsData, activityData] = await Promise.all([
          apiClient.get("/doctor/dashboard-stats").catch(() => ({
            today_appointments: 0,
            waiting_queue: 0,
            pending_access_requests: 0,
            active_consultations: 0,
            total_patients: 0,
            prescriptions_today: 0,
          })),
          apiClient.get("/doctor/recent-activity").catch(() => []),
        ]);
        setStats(statsData);
        setRecentActivity(Array.isArray(activityData) ? activityData : []);
      } catch (err) {
        console.error("Doctor dashboard error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [token]);

  const statCards = [
    {
      title: "Today's Appointments",
      value: stats.today_appointments || 0,
      icon: "📅",
      color: "bg-blue-50 border-blue-100 text-blue-700",
      description: "Scheduled for today",
    },
    {
      title: "Waiting Queue",
      value: stats.waiting_queue || 0,
      icon: "⏳",
      color: "bg-orange-50 border-orange-100 text-orange-700",
      description: "Patients waiting in OPD",
    },
    {
      title: "Pending Access Requests",
      value: stats.pending_access_requests || 0,
      icon: "🛡️",
      color: "bg-purple-50 border-purple-100 text-purple-700",
      description: "Consent sharing requests",
    },
    {
      title: "Active Consultations",
      value: stats.active_consultations || 0,
      icon: "🩺",
      color: "bg-emerald-50 border-emerald-100 text-emerald-700",
      description: "Encounters in progress",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      <DoctorSidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Doctor EHR Workspace Overview
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Live clinical statistics and real-time patient queue metrics.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => navigate('/doctor/appointments')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                Go to OPD Appointments Queue &rarr;
              </button>
            </div>
          </div>

          {/* Live EHR Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {statCards.map((card, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border ${card.color} bg-white shadow-sm flex flex-col justify-between`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{card.title}</p>
                    <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{loading ? "..." : card.value}</h2>
                  </div>
                  <span className="text-2xl">{card.icon}</span>
                </div>
                <p className="text-xs text-slate-500 mt-3 font-medium">{card.description}</p>
              </div>
            ))}
          </div>

          {/* Secondary Live Sections: Notifications & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Clinical Notifications */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>🔔</span> Clinical System Notifications
                  </h3>
                  <button onClick={() => navigate('/doctor/notifications')} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <p className="font-bold text-slate-800">Hospital EHR System Active</p>
                    <p className="text-slate-600 mt-0.5">Live database synchronization enabled for all outpatient visits.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <p className="font-bold text-slate-800">Automatic QR Code Pipeline Ready</p>
                    <p className="text-slate-600 mt-0.5">Prescriptions finalized will auto-generate encrypted patient QR codes.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>📋</span> Recent Clinical Activity Log
                  </h3>
                  <button onClick={() => navigate('/doctor/patients')} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    Patient Directory
                  </button>
                </div>

                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 4).map((act, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">{act.description || act.action || "Clinical encounter recorded"}</p>
                          <p className="text-slate-500 text-[11px]">{act.created_at || "Today"}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded text-[10px]">Logged</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No recent activity logged for today.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DoctorDashboard;
