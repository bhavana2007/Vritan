import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BookingSuccess = ({ data }) => {
    const navigate = useNavigate();
    const aptRes = data.appointmentResponse || {};
    const appointmentUid = aptRes.id || data.appointment_uid || 'APT-123456';
    const digitalToken = aptRes.token || data.token || 'TKN-08';

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/patient/dashboard');
        }, 4000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="max-w-2xl mx-auto py-10 text-center animate-fade-in">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-4 shadow-sm">
                ✓
            </div>
            
            <h2 className="text-4xl font-extrabold text-emerald-600 mb-3">Appointment booked successfully!</h2>
            <p className="text-slate-500 mb-10 text-lg">Redirecting you to your appointments...</p>
            
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-8 mb-10 text-left shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-600 text-white px-5 py-1.5 rounded-bl-xl text-xs font-bold tracking-widest">
                    CONFIRMED
                </div>
                
                <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Appointment ID</p>
                        <p className="font-mono text-2xl font-extrabold text-slate-800">{appointmentUid}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Digital Token</p>
                        <p className="font-mono text-2xl font-extrabold text-blue-700 bg-blue-50 px-4 py-1.5 rounded-lg inline-block border border-blue-100">
                            {digitalToken}
                        </p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-8 gap-x-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Patient</p>
                        <p className="font-bold text-slate-900 text-lg">You</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Doctor</p>
                        <p className="font-bold text-slate-900 text-lg">{aptRes.doctor_name || data.doctor?.full_name || data.doctor?.name}</p>
                        <p className="text-sm text-slate-500 font-medium">{aptRes.department_name || data.department?.name}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date & Time</p>
                        <p className="font-bold text-slate-900 text-lg">{new Date(aptRes.date || data.date).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'})}</p>
                        <p className="text-base font-extrabold text-blue-700 mt-1">{aptRes.start_time || data.time}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hospital</p>
                        <p className="font-bold text-slate-900 text-lg">{aptRes.hospital_name || data.hospital?.name}</p>
                        <p className="text-sm text-slate-500 font-medium">{aptRes.branch_name || data.branch?.name}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <button className="px-8 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm w-full sm:w-auto">
                    Download Receipt
                </button>
                <button 
                    onClick={() => navigate('/patient/appointments')}
                    className="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto"
                >
                    View My Appointments
                </button>
            </div>
        </div>
    );
};

export default BookingSuccess;
