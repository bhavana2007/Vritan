import React, { useEffect, useState } from 'react';
import { apiClient } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

const NotificationCenter = () => {
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('All');
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const tabs = ['All', 'Appointment', 'Pharmacy', 'Laboratory', 'System'];

    useEffect(() => {
        async function fetchNotifications() {
            if (!token) return;
            setLoading(true);
            try {
                const queryParams = activeTab !== 'All' ? `?category=${activeTab}` : '';
                const data = await apiClient.get(`/notifications${queryParams}`);
                setNotifications(data?.data?.items || []);
            } catch (err) {
                console.error("Fetch error", err);
            } finally {
                setLoading(false);
            }
        }
        fetchNotifications();
    }, [token, activeTab]);

    const markAllRead = async () => {
        try {
            await apiClient.put(`/notifications/read-all`);
            setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
        } catch (err) {
            console.error(err);
        }
    };

    const handleActionClick = async (notif) => {
        if (!notif.read_at) {
            try {
                await apiClient.put(`/notifications/${notif.notification_uid}/read`);
            } catch(e) {}
        }
        if (notif.action_url) {
            navigate(notif.action_url);
        }
    };

    const getPriorityStyles = (priority) => {
        switch (priority) {
            case 'Critical': return 'bg-red-50 border-red-200 text-red-900';
            case 'High': return 'bg-orange-50 border-orange-200 text-orange-900';
            default: return 'bg-white border-slate-200 text-slate-800';
        }
    };

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            <div className="flex-1 flex flex-col max-w-5xl mx-auto py-8">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Notification Center</h1>
                        <p className="text-slate-600 mt-1">Unified alerts and workflow actions across VRITAN.</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50">
                        ← Back to Portal
                    </button>
                </header>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                    <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                        <div className="flex gap-4">
                            {tabs.map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        activeTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <button onClick={markAllRead} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            ✓ Mark all as read
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <span className="text-6xl mb-4">📭</span>
                                <p className="text-lg font-medium">No notifications found.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {notifications.map(notif => (
                                    <div key={notif.id} className={`p-5 rounded-xl border flex gap-4 transition-all hover:shadow-md ${getPriorityStyles(notif.priority)} ${!notif.read_at ? 'ring-2 ring-indigo-500/50' : 'opacity-80'}`}>
                                        <div className="shrink-0 pt-1">
                                            {notif.category === 'Laboratory' ? '🧪' : 
                                             notif.category === 'Pharmacy' ? '💊' : 
                                             notif.category === 'Appointment' ? '🩺' : '🔔'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-lg">{notif.title}</h3>
                                                <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                                                    {new Date(notif.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="opacity-80 mb-4">{notif.message}</p>
                                            
                                            {notif.action_url && (
                                                <button 
                                                    onClick={() => handleActionClick(notif)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                                                        notif.priority === 'Critical' ? 'bg-red-600 text-white hover:bg-red-700' :
                                                        'bg-indigo-600 text-white hover:bg-indigo-700'
                                                    }`}
                                                >
                                                    {notif.priority === 'Critical' ? 'Review Immediately' : 'View Details'}
                                                </button>
                                            )}
                                        </div>
                                        {!notif.read_at && (
                                            <div className="shrink-0 flex items-center">
                                                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationCenter;
