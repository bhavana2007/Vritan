import React, { useState, useEffect } from 'react';
import { appointmentsApi } from '../../api/appointments';

const MyAppointments = () => {
    const [activeTab, setActiveTab] = useState('upcoming');
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedApt, setSelectedApt] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);

    const fetchAppointments = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await appointmentsApi.getAppointments();
            setAppointments(data || []);
        } catch (err) {
            console.error("Failed to fetch appointments", err);
            setError("Failed to load appointments");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
        const interval = setInterval(() => fetchAppointments(true), 5000);
        return () => clearInterval(interval);
    }, []);

    const handleCancel = async (id) => {
        if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
        
        setIsCancelling(true);
        try {
            await appointmentsApi.cancelAppointment(id);
            await fetchAppointments(); // refresh
        } catch (err) {
            console.error("Cancellation failed", err);
            alert("Failed to cancel appointment.");
        } finally {
            setIsCancelling(false);
        }
    };

    const upcomingStatuses = ['Requested', 'Confirmed', 'Rescheduled', 'Checked-In', 'Waiting', 'In Progress'];
    const filtered = appointments.filter(a => 
        (activeTab === 'upcoming' && upcomingStatuses.includes(a.status)) || 
        (activeTab === 'completed' && ['Completed', 'Prescription Generated', 'Lab Tests Ordered'].includes(a.status)) ||
        (activeTab === 'cancelled' && a.status === 'Cancelled') ||
        (activeTab === 'missed' && a.status === 'Missed')
    );

    return (
        <div className="py-4">
            <div className="flex gap-4 mb-6 border-b pb-2">
                {['upcoming', 'completed', 'cancelled', 'missed'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-2 px-2 capitalize font-medium text-sm transition-colors relative ${
                            activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab}
                        {activeTab === tab && (
                            <span className="absolute bottom-[-9px] left-0 w-full h-0.5 bg-blue-600 rounded-t-lg"></span>
                        )}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {isLoading && appointments.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                        Loading appointments...
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-red-500 bg-red-50 rounded-xl border border-red-200">
                        {error}
                    </div>
                ) : filtered.length > 0 ? filtered.map(apt => (
                    <div key={apt.id} className="bg-white border rounded-xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 hover:shadow-md transition-shadow">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${
                                    upcomingStatuses.includes(apt.status) ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700'
                                }`}>
                                    {apt.status}
                                </span>
                                <span className="font-mono text-sm text-gray-500">Token: {apt.token}</span>
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg">{apt.doctor_name || apt.doctor}</h3>
                            <p className="text-gray-500 text-sm">{apt.hospital_name || apt.hospital}</p>
                        </div>

                        <div className="text-left sm:text-right flex-1 sm:flex-none">
                            <p className="font-semibold text-gray-800">{apt.date}</p>
                            <p className="text-blue-600 font-medium">{apt.start_time || apt.time}</p>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={() => setSelectedApt(apt)}
                                className="flex-1 sm:flex-none px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                            >
                                View
                            </button>
                            {upcomingStatuses.includes(apt.status) && (
                                <button 
                                    onClick={() => handleCancel(apt.appointment_uid || apt.id)}
                                    disabled={isCancelling}
                                    className="flex-1 sm:flex-none px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-xl border border-dashed">
                        No {activeTab} appointments found.
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {selectedApt && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-fade-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800">Appointment Details</h3>
                            <button onClick={() => setSelectedApt(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor</p>
                                <p className="font-semibold text-slate-800">{selectedApt.doctor_name || selectedApt.doctor}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hospital / Clinic</p>
                                <p className="font-medium text-slate-700">{selectedApt.hospital_name || selectedApt.hospital}</p>
                            </div>
                            <div className="flex gap-6">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                                    <p className="font-medium text-slate-700">{selectedApt.date}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Time</p>
                                    <p className="font-medium text-slate-700">{selectedApt.start_time || selectedApt.time}</p>
                                </div>
                            </div>
                            <div className="flex gap-6">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase border border-blue-100">
                                        {selectedApt.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Token</p>
                                    <p className="font-mono text-sm font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">{selectedApt.token}</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                            <button 
                                onClick={() => setSelectedApt(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-sm transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAppointments;

