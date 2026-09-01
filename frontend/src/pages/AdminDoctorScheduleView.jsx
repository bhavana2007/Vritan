import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OrgAdminSidebar from '../components/OrgAdminSidebar';
import DoctorSchedule from './DoctorSchedule';
import { apiClient } from '../api/client';

const AdminDoctorScheduleView = () => {
    const { doctorId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('configuration');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
            const data = await apiClient.get(`/api/v1/appointments/slots?doctor_id=${doctorId}&date=${selectedDate}`);
            setSlots(data || []);
        } catch (error) {
            console.error("Failed to load slots", error);
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'calendar') {
            fetchSlots();
        }
    }, [activeTab, selectedDate, doctorId]);

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="doctors" />
            
            <div className="flex-1 flex flex-col overflow-y-auto min-w-0 ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10 sticky top-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/org-admin/doctors')} className="text-slate-400 hover:text-slate-600 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-bold text-slate-800">Doctor Schedule</h1>
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">View Only</span>
                        </div>
                        <p className="text-slate-500 text-sm mt-1 ml-8">View the doctor's weekly availability, exceptions, and daily calendar.</p>
                    </div>
                </header>

                <main className="flex-1 p-8 max-w-6xl w-full mx-auto">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 mb-6">
                        <button
                            onClick={() => setActiveTab('configuration')}
                            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'configuration' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            Availability Configuration
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            Appointment Calendar
                        </button>
                    </div>

                    {activeTab === 'configuration' ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <DoctorSchedule doctorId={doctorId} isReadOnly={true} />
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                                <h2 className="text-lg font-bold text-slate-800">Daily Appointment Calendar</h2>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-semibold text-slate-600">Select Date:</label>
                                    <input 
                                        type="date" 
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                    <button 
                                        onClick={() => {
                                            const d = new Date(selectedDate);
                                            d.setDate(d.getDate() - 1);
                                            setSelectedDate(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                                    >
                                        &larr; Prev
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const d = new Date(selectedDate);
                                            d.setDate(d.getDate() + 1);
                                            setSelectedDate(d.toISOString().split('T')[0]);
                                        }}
                                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            </div>

                            {loadingSlots ? (
                                <div className="flex justify-center items-center h-48">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                                </div>
                            ) : slots.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                                    No slots generated for this date. The doctor may be on leave or have no availability.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {slots.map((slot, idx) => {
                                        let statusColor = "bg-emerald-50 border-emerald-200 text-emerald-800";
                                        let statusDot = "bg-emerald-500";
                                        let statusText = "Available";
                                        
                                        if (slot.status === "BOOKED") {
                                            statusColor = "bg-rose-50 border-rose-200 text-rose-800 opacity-90";
                                            statusDot = "bg-rose-500";
                                            statusText = "Booked";
                                        } else if (slot.status === "LOCKED") {
                                            statusColor = "bg-amber-50 border-amber-200 text-amber-800";
                                            statusDot = "bg-amber-500";
                                            statusText = "Temporarily Locked";
                                        } else if (slot.status === "COMPLETED" || slot.status === "EXPIRED" || slot.status === "CANCELLED") {
                                            statusColor = "bg-slate-50 border-slate-200 text-slate-500";
                                            statusDot = "bg-slate-400";
                                            statusText = slot.status.charAt(0).toUpperCase() + slot.status.slice(1).toLowerCase();
                                        }

                                        return (
                                            <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${statusColor}`}>
                                                <div className="font-bold font-mono text-lg">
                                                    {slot.start_time}
                                                </div>
                                                <div className="flex items-center gap-2 bg-white/60 px-2.5 py-1 rounded-md">
                                                    <div className={`w-2 h-2 rounded-full ${statusDot}`}></div>
                                                    <span className="text-xs font-bold uppercase tracking-wider">{statusText}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDoctorScheduleView;
