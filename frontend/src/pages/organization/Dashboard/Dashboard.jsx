import React, { useState, useEffect } from 'react';
import { organizationApi } from '../../../api/organizationApi';

const Dashboard = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Mock orgId for now, would come from Context/Auth
    const orgId = 1;

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await organizationApi.getDashboardMetrics(orgId);
                setMetrics(data.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, [orgId]);

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading enterprise dashboard...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Organization Dashboard</h1>
                <div className="flex space-x-3">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition">Add Branch</button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md shadow-sm hover:bg-gray-50 transition">Reports</button>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Total Doctors</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.total_doctors || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Total Patients</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.total_patients || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Today's Appointments</h3>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.todays_appointments || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 bg-gradient-to-br from-indigo-50 to-white">
                    <h3 className="text-sm font-medium text-indigo-600">AI Health Score</h3>
                    <p className="text-3xl font-bold text-indigo-900 mt-2">{metrics?.ai_organization_health_score || 'N/A'}</p>
                </div>
            </div>

            {/* AI Insights & Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex items-center justify-center">
                    <p className="text-gray-400">Appointment Trend Chart (To be implemented with Recharts)</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                    <h3 className="font-semibold text-gray-800 mb-4">AI Workload Prediction</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                            <p className="text-sm text-yellow-800 font-medium">Cardiology Department</p>
                            <p className="text-xs text-yellow-600 mt-1">High load expected between 2PM - 5PM</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                            <p className="text-sm text-green-800 font-medium">Orthopedics</p>
                            <p className="text-xs text-green-600 mt-1">Optimal staffing levels detected</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
