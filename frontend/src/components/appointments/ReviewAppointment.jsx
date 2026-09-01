import React, { useState } from 'react';
import { appointmentsApi } from '../../api/appointments';

const ReviewAppointment = ({ data, onNext, onBack }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const payload = {
                doctor_id: data.doctor?.user_id || data.doctor?.id,
                department_id: data.department?.id || null,
                branch_id: data.branch?.id || null,
                organization_id: data.hospital?.id || null,
                date: data.date,
                time: data.time,
                slot_id: data.slot?.id,
                appointment_type: data.appointment_type
            };
            
            console.log("FRONTEND BOOKING PAYLOAD");
            console.log("doctor_id=", payload.doctor_id);
            console.log("doctor_name=", data.doctor?.full_name || data.doctor?.name);
            console.log("hospital_id=", payload.organization_id);
            console.log("branch_id=", payload.branch_id);
            console.log("department_id=", payload.department_id);
            console.log("selected_date=", payload.date);
            console.log("slot_id=", payload.slot_id);
            console.log("start_time=", payload.time);
            console.log("FINAL BOOKING PAYLOAD", JSON.stringify(payload, null, 2));
            
            const response = await appointmentsApi.bookAppointment(payload);
            
            onNext({ appointmentResponse: response });
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to book appointment. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in py-6">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">Review Your Appointment</h2>
            
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6 font-medium text-center">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="bg-slate-50 px-8 py-5 border-b border-slate-200">
                    <h3 className="font-extrabold text-slate-800 text-lg uppercase tracking-wide">Consultation Details</h3>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Doctor</p>
                        <p className="font-bold text-slate-900 text-lg">{data.doctor?.full_name || data.doctor?.name || 'Doctor Name'}</p>
                        <p className="text-sm font-medium text-slate-600 mt-1">{data.doctor?.specialization || data.department?.name || 'General Specialist'}</p>
                    </div>
                    
                    {data.appointment_type === 'Hospital' ? (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hospital</p>
                            <p className="font-bold text-slate-900 text-lg">{data.hospital?.name || 'Hospital Name'}</p>
                            <p className="text-sm font-medium text-slate-600 mt-1">{data.branch?.name || 'Branch'}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Consultation Mode / Location</p>
                            <p className="font-bold text-slate-900 text-lg">{data.appointment_type}</p>
                            <p className="text-sm font-medium text-slate-600 mt-1">
                                {data.appointment_type === 'Independent Clinic' 
                                    ? (data.doctor?.clinic_name || data.doctor?.clinic_address || 'Doctor\'s Clinic') 
                                    : 'Online Consultation (Video/Voice/Chat)'}
                            </p>
                        </div>
                    )}
                    
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date & Time</p>
                        <p className="font-bold text-slate-900 text-lg">{new Date(data.date).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                        <p className="text-base font-extrabold text-blue-700 mt-1">{data.time || 'Time'}</p>
                    </div>
                    
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estimated Fee</p>
                        <p className="font-extrabold text-slate-900 text-2xl">₹ {data.doctor?.consultation_fee || data.doctor?.fee || '500'}</p>
                        <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-2 py-1 rounded border border-emerald-100">
                            {data.appointment_type === 'Telemedicine' ? '✓ Pay Online' : '✓ Pay at Clinic/Hospital'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-200 gap-4">
                <button 
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors disabled:opacity-50"
                >
                    &larr; Back
                </button>
                
                <button 
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className={`w-full sm:w-auto px-10 py-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-3 shadow-sm ${
                        isSubmitting 
                            ? 'bg-blue-400 text-white cursor-wait' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transform hover:-translate-y-0.5'
                    }`}
                >
                    {isSubmitting ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Confirming Booking...
                        </>
                    ) : (
                        'Confirm Appointment'
                    )}
                </button>
            </div>
        </div>
    );
};

export default ReviewAppointment;
