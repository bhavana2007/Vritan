import React, { useEffect, useState } from 'react';
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';
import { organizationApi } from '../api/organizationApi';
import { useNavigate } from 'react-router-dom';

const OrgAdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    useEffect(() => {
        async function fetchAnalytics() {
            if (!orgVritanId) return;
            try {
                const response = await organizationApi.getDashboardMetrics(orgVritanId);
                if (response.success === false) {
                    throw new Error(response.message || "Failed to load metrics");
                }
                setAnalytics(response.data);
            } catch (err) {
                console.error("Dashboard fetch error", err);
                setError(err.message || "Unable to retrieve analytics.");
            } finally {
                setLoading(false);
            }
        }
        fetchAnalytics();
    }, [orgVritanId]);

    const summary = analytics?.summary || {
        doctors: 0,
        departments: 0,
        branches: 0,
        today_appointments: 0,
        active_patients: 0,
        pending_verifications: 0,
        ai_documents_processed: 0
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="dashboard" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-slate-900 px-8 py-5 flex justify-between items-center shadow-md z-10 text-white">
                    <div>
                        <h1 className="text-2xl font-bold">Vritan Hospital Admin Portal</h1>
                        <p className="text-slate-400 text-xs mt-1">
                            Enterprise Code: <span className="font-mono text-emerald-400 font-bold">{orgVritanId}</span>
                        </p>
                    </div>
                    <div className="bg-emerald-600/10 text-emerald-400 px-4 py-2 rounded-lg font-bold text-sm border border-emerald-500/20 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Status: Active & Verified
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : error ? (
                        <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-lg text-center space-y-4">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto">⚠️</div>
                            <h2 className="text-xl font-bold text-slate-800">Unable to Load Dashboard</h2>
                            <p className="text-sm text-slate-600">{error}</p>
                            <div className="pt-2">
                                <button 
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-8">
                            {/* KPI Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Affiliated Doctors</p>
                                    <div className="flex items-baseline justify-between mt-4">
                                        <p className="text-3xl font-extrabold text-slate-800">{summary.doctors}</p>
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Departments</p>
                                    <div className="flex items-baseline justify-between mt-4">
                                        <p className="text-3xl font-extrabold text-slate-800">{summary.departments}</p>
                                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded">{summary.branches} Branches</span>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Appointments</p>
                                    <div className="flex items-baseline justify-between mt-4">
                                        <p className="text-3xl font-extrabold text-slate-800">{summary.today_appointments}</p>
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Normal Load</span>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition bg-gradient-to-br from-emerald-50/30 to-white">
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">AI Medical Docs Processed</p>
                                    <div className="flex items-baseline justify-between mt-4">
                                        <p className="text-3xl font-extrabold text-emerald-950">{summary.ai_documents_processed}</p>
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">99.8% Acc</span>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Analytics Details */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Appointment Workload Trends</h3>
                                    <div className="h-64 flex flex-col justify-between">
                                        {/* Simple HTML bar chart representative layout */}
                                        <div className="flex items-end justify-between h-48 px-4 pt-4 border-b">
                                            {(analytics?.charts?.appointment_trends || []).map((t, idx) => (
                                                <div key={idx} className="flex flex-col items-center w-8">
                                                    <div 
                                                        className="w-full bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-all duration-300"
                                                        style={{ height: `${(t.appointments / 35) * 100}%` }}
                                                    ></div>
                                                    <span className="text-[10px] font-bold text-slate-400 mt-2">{t.day}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 text-center mt-2">Aggregated daily appointment traffic (Last 7 days)</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Department Workload Prediction</h3>
                                    <div className="space-y-4 flex-1 overflow-y-auto">
                                        {(analytics?.charts?.department_workload || []).map((dept, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{dept.department}</p>
                                                    <p className="text-xs text-slate-400">Current Queue Size</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    dept.patients > 4 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                                }`}>
                                                    {dept.patients} Patients
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Operational Status Panel */}
                            <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-1">Scale from Single Clinic to Nationwide Networks</h4>
                                    <p className="text-sm text-slate-400">Add branches, assign doctors, and monitor workloads seamlessly without limits.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => navigate("/org-admin/branches")}
                                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition"
                                    >
                                        + Add Branch
                                    </button>
                                    <button 
                                        onClick={() => navigate("/org-admin/doctors")}
                                        className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs border border-slate-700 transition"
                                    >
                                        Manage Doctors
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OrgAdminDashboard;
