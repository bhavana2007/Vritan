import React, { useEffect, useState } from 'react';
import { useAuth } from "../../../hooks/useAuth";
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';
import { organizationApi } from '../../../api/organizationApi';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '../../../components/ErrorBoundary';

const AppointmentsContent = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [total, setTotal] = useState(0);

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    useEffect(() => {
        async function fetchBranches() {
            if (!orgVritanId) return;
            try {
                const response = await organizationApi.getBranches(orgVritanId);
                if (response.success) {
                    setBranches(response.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch branches", err);
            }
        }
        fetchBranches();
    }, [orgVritanId]);

    useEffect(() => {
        async function fetchAppointments() {
            if (!orgVritanId) {
                setError("No organization details found on your profile.");
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const params = {};
                if (statusFilter !== "All") params.status = statusFilter;
                if (selectedBranch) params.branch_id = selectedBranch;
                if (searchQuery) params.search = searchQuery;
                
                const response = await organizationApi.getAppointments(orgVritanId, params);
                if (response.success === false) {
                    throw new Error(response.message || "Failed to load appointments");
                }
                setAppointments(response.data?.appointments || []);
                setTotal(response.data?.total || 0);
            } catch (err) {
                console.error("Appointments fetch error", err);
                setError(err.message || "Unable to retrieve appointments.");
            } finally {
                setLoading(false);
            }
        }
        
        const delayDebounce = setTimeout(() => {
            fetchAppointments();
        }, 500);
        
        return () => clearTimeout(delayDebounce);
    }, [orgVritanId, statusFilter, selectedBranch, searchQuery]);

    const filteredAppointments = appointments;

    const getStatusBadgeClass = (status) => {
        const base = "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ";
        switch (status?.toLowerCase()) {
            case 'confirmed':
            case 'completed':
                return base + "bg-emerald-50 text-emerald-700 border border-emerald-200";
            case 'requested':
            case 'pending':
                return base + "bg-amber-50 text-amber-700 border border-amber-200";
            case 'cancelled':
            case 'missed':
                return base + "bg-rose-50 text-rose-700 border border-rose-200";
            default:
                return base + "bg-slate-50 text-slate-700 border border-slate-200";
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="appointments" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-slate-900 px-8 py-5 flex justify-between items-center shadow-md z-10 text-white">
                    <div>
                        <h1 className="text-2xl font-bold">Organization Appointments</h1>
                        <p className="text-slate-400 text-xs mt-1">
                            Enterprise Code: <span className="font-mono text-emerald-400 font-bold">{orgVritanId}</span>
                        </p>
                    </div>
                    <div className="bg-emerald-600/10 text-emerald-400 px-4 py-2 rounded-lg font-bold text-sm border border-emerald-500/20 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Management Hub
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
                            <h2 className="text-xl font-bold text-slate-800">Connection Error</h2>
                            <p className="text-sm text-slate-600">{error}</p>
                            <div className="pt-2">
                                <button 
                                    onClick={() => navigate("/org-admin/dashboard")}
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-6">
                            {/* Filter Bar */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
                                        {["All", "Requested", "Confirmed", "Completed", "Cancelled"].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                                    statusFilter === status
                                                        ? "bg-slate-900 text-white"
                                                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-xs text-slate-500 font-medium">
                                        Showing {filteredAppointments.length} of {total} appointments
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <input 
                                        type="text" 
                                        placeholder="Search by patient, doctor, token..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="px-4 py-2 text-sm border border-slate-300 rounded-lg flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Appointments Grid/Table */}
                            {filteredAppointments.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-4 shadow-sm">
                                    <div className="text-5xl">📅</div>
                                    <h3 className="text-lg font-bold text-slate-800">No Appointments Found</h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                        There are no appointments registered under this organization matching the status "{statusFilter}".
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-550 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                                    <th className="px-6 py-4">Token / ID</th>
                                                    <th className="px-6 py-4">Patient</th>
                                                    <th className="px-6 py-4">Doctor</th>
                                                    <th className="px-6 py-4">Branch / Dept</th>
                                                    <th className="px-6 py-4">Date & Time</th>
                                                    <th className="px-6 py-4">Type / Mode</th>
                                                    <th className="px-6 py-4">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                                                {filteredAppointments.map((apt) => (
                                                    <tr key={apt.id} className="hover:bg-slate-50/50 transition">
                                                        <td className="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                                                            {apt.token_number || apt.appointment_uid?.substring(0, 8) || "N/A"}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-slate-800">{apt.patient_name}</div>
                                                            <div className="text-slate-400 text-xs">{apt.patient_phone}</div>
                                                        </td>
                                                        <td className="px-6 py-4 font-semibold text-slate-700">
                                                            {apt.doctor_name}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div>{apt.branch_name}</div>
                                                            <div className="text-xs text-slate-400">{apt.department_name}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-semibold text-slate-800">{apt.date}</div>
                                                            <div className="text-xs text-slate-400">{apt.start_time} - {apt.end_time}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div>{apt.appointment_type}</div>
                                                            <div className="text-xs text-slate-400">{apt.consultation_mode}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={getStatusBadgeClass(apt.status)}>
                                                                {apt.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

const OrgAdminAppointments = () => {
    return (
        <ErrorBoundary>
            <AppointmentsContent />
        </ErrorBoundary>
    );
};

export default OrgAdminAppointments;
