import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../services/api';
import { BarChart2, TrendingUp, Users, Activity, Calendar, Building, Building2, Droplet, Search } from 'lucide-react';
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';

const OrgAdminAnalytics = () => {
    const { user } = useAuth();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                if (user?.organization_id) {
                    const response = await api.get(`/organizations/${user.organization_id}/branches`);
                    setBranches(response.data.data || []);
                }
            } catch (err) {
                console.error("Failed to load branches", err);
            }
        };
        fetchBranches();
    }, [user]);

    useEffect(() => {
        const fetchMetrics = async () => {
            setLoading(true);
            setError('');
            try {
                if (!user?.organization_id) return;
                let url = `/organizations/${user.organization_id}/metrics`;
                
                const params = new URLSearchParams();
                if (selectedBranch) params.append('branch_id', selectedBranch);
                if (startDate) params.append('start_date', startDate);
                if (endDate) params.append('end_date', endDate);
                
                if (params.toString()) {
                    url += `?${params.toString()}`;
                }
                
                const response = await api.get(url);
                setMetrics(response.data.data || null);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
                setError('Unable to load analytics data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, [user, selectedBranch, startDate, endDate]);

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="analytics" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Analytics Dashboard</h1>
                        <p className="text-slate-500 text-xs mt-1">Comprehensive overview of your organization's performance.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-64">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Branches</option>
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : metrics ? (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Total Appointments</p>
                                    <h3 className="text-3xl font-bold text-gray-900">{metrics.summary.total_appointments}</h3>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <Calendar className="w-6 h-6" />
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Active Patients</p>
                                    <h3 className="text-3xl font-bold text-gray-900">{metrics.summary.active_patients}</h3>
                                </div>
                                <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                                    <Users className="w-6 h-6" />
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">AI Documents Processed</p>
                                    <h3 className="text-3xl font-bold text-gray-900">{metrics.summary.ai_documents_processed}</h3>
                                </div>
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 mb-1">Completed Consultations</p>
                                    <h3 className="text-3xl font-bold text-gray-900">{metrics.summary.completed_appointments}</h3>
                                </div>
                                <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>
                        </div>

                        {/* Detailed Metrics */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Infrastructure Overview</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center text-gray-700">
                                            <Building className="w-5 h-5 mr-3 text-blue-500" />
                                            <span>Branches</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">{metrics.summary.branches}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center text-gray-700">
                                            <Users className="w-5 h-5 mr-3 text-indigo-500" />
                                            <span>Doctors</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">{metrics.summary.doctors}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center text-gray-700">
                                            <Droplet className="w-5 h-5 mr-3 text-red-500" />
                                            <span>Laboratories</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">{metrics.summary.laboratories}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center text-gray-700">
                                            <Building2 className="w-5 h-5 mr-3 text-green-500" />
                                            <span>Pharmacies</span>
                                        </div>
                                        <span className="font-semibold text-gray-900">{metrics.summary.pharmacies}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Workload Today</h3>
                                {metrics.charts.department_workload.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No workload data available</p>
                                ) : (
                                    <div className="space-y-4">
                                        {metrics.charts.department_workload.map((dept, index) => (
                                            <div key={index} className="flex flex-col">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-medium text-gray-700">{dept.department}</span>
                                                    <span className="text-sm font-semibold text-gray-900">{dept.patients} patients</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, (dept.patients / (Math.max(...metrics.charts.department_workload.map(d => d.patients)) || 1)) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OrgAdminAnalytics;
