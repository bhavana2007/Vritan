import React, { useEffect, useState } from 'react';
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';

const OrgMonitoringHub = () => {
    const { user, token } = useAuth();
    const [activeTab, setActiveTab] = useState('appointment');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    useEffect(() => {
        async function fetchMonitoringData() {
            if (!token || !orgVritanId) return;
            setLoading(true);
            setError("");
            try {
                const response = await fetch(`${API_BASE}/api/v1/organizations/${orgVritanId}/monitoring/${activeTab}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const resJson = await response.json();
                if (!response.ok) throw new Error(parseFastApiDetail(resJson));
                setData(resJson.data || {});
            } catch (err) {
                console.error("Monitoring fetch error", err);
                setError(err.message || "Failed to load monitoring data.");
            } finally {
                setLoading(false);
            }
        }
        fetchMonitoringData();
    }, [token, orgVritanId, activeTab]);

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="monitoring" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Clinical Monitoring Hub</h1>
                        <p className="text-slate-500 text-sm mt-1">Supervise live queues without accessing sensitive clinical records.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                        <div className="border-b flex">
                            <button 
                                onClick={() => setActiveTab('appointment')}
                                className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${
                                    activeTab === 'appointment' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                🩺 Appointment Monitoring
                            </button>
                            <button 
                                onClick={() => setActiveTab('pharmacy')}
                                className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${
                                    activeTab === 'pharmacy' ? 'border-teal-600 text-teal-700 bg-teal-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                💊 Pharmacy Monitoring
                            </button>
                            <button 
                                onClick={() => setActiveTab('laboratory')}
                                className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${
                                    activeTab === 'laboratory' ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                🧪 Laboratory Monitoring
                            </button>
                        </div>
                        
                        <div className="p-8">
                            {loading ? (
                                <div className="flex items-center justify-center h-48">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500 font-bold">
                                    ⚠️ {error}
                                </div>
                            ) : !data || Object.keys(data).length === 0 ? (
                                <div className="p-16 text-center space-y-4">
                                    <div className="text-4xl">📊</div>
                                    <h3 className="text-lg font-bold text-slate-800">No Monitoring Data</h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                        No active queues or records found for this module.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    {Object.entries(data).map(([key, val]) => (
                                        <div key={key} className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex flex-col justify-center items-center">
                                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                                                {key.replace(/_/g, ' ')}
                                            </p>
                                            <p className={`text-4xl font-black ${
                                                activeTab === 'appointment' ? 'text-blue-600' :
                                                activeTab === 'pharmacy' ? 'text-teal-600' : 'text-purple-600'
                                            }`}>
                                                {val}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OrgMonitoringHub;
