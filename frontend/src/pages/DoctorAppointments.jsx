import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorSidebar from '../components/DoctorSidebar';
import { apiClient } from '../api/client';

const DoctorAppointments = () => {
    const navigate = useNavigate();
    
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState({ today: 0, waiting: 0, completed: 0, missed: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, []);

    const handleStartConsultation = async (uid) => {
        try {
            await apiClient.put(`/api/v1/appointments/${uid}/start`);
            navigate(`/doctor/consultation/${uid}`);
        } catch (error) {
            console.error("Failed to start appointment:", error);
            alert("Failed to start consultation.");
        }
    };

    const fetchAppointments = async () => {
        try {
            const data = await apiClient.get('/api/v1/appointments/my-appointments');
            
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
            const today = formatter.format(new Date());
            const todayApts = data.filter(a => a.date === today);
            
            const waiting = todayApts.filter(a => ['Checked-In', 'Waiting'].includes(a.status)).length;
            const completed = todayApts.filter(a => a.status === 'Completed').length;
            const missed = todayApts.filter(a => ['Missed', 'Cancelled'].includes(a.status)).length;
            
            setStats({
                today: todayApts.length,
                waiting,
                completed,
                missed
            });
            const todayStr = today;
            const allApts = [...data].sort((a, b) => {
                const dateA = a.date || '';
                const dateB = b.date || '';
                const timeA = a.start_time || '';
                const timeB = b.start_time || '';
                
                // If dates are the same, sort by time ascending
                if (dateA === dateB) {
                    return timeA.localeCompare(timeB);
                }
                
                const isTodayA = dateA === todayStr;
                const isTodayB = dateB === todayStr;
                
                if (isTodayA) return -1;
                if (isTodayB) return 1;
                
                const isFutureA = dateA > todayStr;
                const isFutureB = dateB > todayStr;
                
                if (isFutureA && !isFutureB) return -1;
                if (!isFutureA && isFutureB) return 1;
                
                if (isFutureA && isFutureB) {
                    return dateA.localeCompare(dateB); // Ascending for future
                }
                
                return dateB.localeCompare(dateA); // Descending for past
            });
            
            const grouped = allApts.reduce((acc, apt) => {
                const dateStr = apt.date || 'Unknown Date';
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push({
                    id: apt.id,
                    uid: apt.appointment_uid,
                    token: apt.token || apt.token_number || 'N/A',
                    patient: apt.patient_name || 'N/A',
                    time: apt.start_time,
                    type: apt.appointment_type || 'N/A',
                    status: apt.status,
                    wait: apt.status === 'Waiting' ? '10 mins' : (apt.status === 'Checked-In' ? '0 mins' : '-')
                });
                return acc;
            }, {});
            
            setQueue(grouped);
        } catch (error) {
            console.error("Failed to load appointments:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getAppointmentAction = (apt) => {
        switch(apt.status) {
            case 'Confirmed':
                return (
                    <button 
                        onClick={() => handleStartConsultation(apt.uid || apt.id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm transition-all group-hover:-translate-y-0.5"
                    >
                        Start Consultation
                    </button>
                );
            case 'In Progress':
                return (
                    <button 
                        onClick={() => handleStartConsultation(apt.uid || apt.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-all group-hover:-translate-y-0.5"
                    >
                        Continue Consultation
                    </button>
                );
            case 'Completed':
            case 'Cancelled':
            case 'Missed':
                return (
                    <button 
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 shadow-sm transition-all group-hover:-translate-y-0.5"
                    >
                        View Details
                    </button>
                );
            default:
                return null;
        }
    };

    const todayRef = React.useRef(null);
    useEffect(() => {
        if (!isLoading && todayRef.current) {
            todayRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isLoading]);

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <DoctorSidebar currentPage="appointments" />
            
            <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Appointment Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your daily queue and ongoing consultations.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-full">
                            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                        </span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Today's Appointments</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.today}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl">📅</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Waiting Queue</p>
                                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.waiting}</p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-xl">👥</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Completed</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.completed}</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl">✓</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Missed/Cancelled</p>
                                <p className="text-3xl font-bold text-red-500 mt-1">{stats.missed}</p>
                            </div>
                            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xl">⚠️</div>
                        </div>
                    </div>

                    {/* Appointments Grouped by Date */}
                    <div className="space-y-8">
                        {isLoading ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                                Loading appointments...
                            </div>
                        ) : Object.keys(queue).length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                                No appointments found.
                            </div>
                        ) : (
                            Object.entries(queue).map(([dateStr, apts]) => (
                                <div 
                                    key={dateStr} 
                                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                                    ref={dateStr === new Date().toISOString().split('T')[0] ? todayRef : null}
                                >
                                    <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <h2 className="text-lg font-bold text-slate-800">
                                            {dateStr === new Date().toISOString().split('T')[0] ? "Today" : new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </h2>
                                        <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">{apts.length} appointments</span>
                                    </div>
                                    
                                    <div className="p-0 overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                                    <th className="px-6 py-4 font-medium">Token</th>
                                                    <th className="px-6 py-4 font-medium">Patient</th>
                                                    <th className="px-6 py-4 font-medium">Time</th>
                                                    <th className="px-6 py-4 font-medium">Type</th>
                                                    <th className="px-6 py-4 font-medium">Status</th>
                                                    <th className="px-6 py-4 font-medium">Wait Time</th>
                                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {apts.map((apt) => (
                                                    <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4 font-mono font-medium text-slate-600">{apt.token}</td>
                                                        <td className="px-6 py-4 font-semibold text-slate-800">{apt.patient}</td>
                                                        <td className="px-6 py-4 text-slate-600 font-medium">{apt.time}</td>
                                                        <td className="px-6 py-4 text-sm text-slate-500">{apt.type}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                                apt.status === 'Waiting' || apt.status === 'Requested' ? 'bg-orange-100 text-orange-700' :
                                                                apt.status === 'Checked-In' ? 'bg-blue-100 text-blue-700' :
                                                                apt.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {apt.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500">{apt.wait}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {getAppointmentAction(apt)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DoctorAppointments;
