import React, { useState, useEffect } from 'react';
import { appointmentsApi } from '../../api/appointments';

const DoctorSelect = ({ data, onNext, onBack }) => {
    const [doctors, setDoctors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                let res;
                if (data.appointment_type === 'Independent Clinic') {
                    res = await appointmentsApi.getIndependentDoctors();
                } else if (data.appointment_type === 'Telemedicine') {
                    res = await appointmentsApi.getTelemedicineDoctors();
                } else {
                    if (!data.department?.id) {
                        setError("Department not found. Please go back and select a department.");
                        setIsLoading(false);
                        return;
                    }
                    res = await appointmentsApi.getDoctors(data.department.id);
                }
                setDoctors(res || []);
            } catch (err) {
                console.error(err);
                setError("Failed to load doctors.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchDoctors();
    }, [data.department, data.appointment_type]);

    if (isLoading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Loading doctors...</div>;
    }

    if (error) {
        return (
            <div className="max-w-5xl mx-auto py-6">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 mb-6">
                    {error}
                    <pre className="mt-4 p-4 bg-red-100 rounded text-xs overflow-auto">
                        DEBUG DATA: {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
                <button onClick={onBack} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium">Back</button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-6 animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900">Select Doctor</h2>
                    {data.appointment_type === 'Hospital' ? (
                        <p className="text-slate-500 mt-1 font-medium bg-slate-100 px-3 py-1 rounded-full inline-block text-sm">{data.department?.name} Department</p>
                    ) : (
                        <p className="text-slate-500 mt-1 font-medium bg-slate-100 px-3 py-1 rounded-full inline-block text-sm">{data.appointment_type}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {doctors.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                        <span className="text-4xl block mb-2">👨‍⚕️</span>
                        <p className="text-slate-600 font-medium">No doctors available.</p>
                    </div>
                ) : (
                    doctors.map(doc => {
                        const docId = doc.user_id || doc.id;
                        const docName = doc.full_name || doc.name || 'Dr. Doctor';
                        const docQual = doc.qualification || doc.qualifications || 'Specialist';
                        return (
                            <div key={docId} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col hover:shadow-md transition-shadow group">
                                <div className="flex gap-4 items-start mb-4">
                                    {doc.profile_image_url ? (
                                        <img src={doc.profile_image_url} alt={docName} className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-extrabold text-2xl uppercase border border-blue-100">
                                            {(docName).replace('Dr. ', '').charAt(0)}
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">{docName}</h3>
                                            {doc.rating && (
                                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    {doc.rating} ★
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 font-medium">{docQual}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {doc.years_of_experience ? `Exp: ${doc.years_of_experience} Yrs | ` : doc.experience_years ? `Exp: ${doc.experience_years} Yrs | ` : ''}
                                            Speaks: {doc.languages_spoken || doc.languages || 'English, Hindi'}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center mb-4 text-sm border border-slate-100">
                                    <div>
                                        <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Consultation Fee</span>
                                        <span className="font-extrabold text-slate-800 text-base">₹{doc.consultation_fee || 500}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-500 block text-xs font-bold uppercase mb-1">Practice Type</span>
                                        <span className="font-bold text-blue-700">{doc.practice_type || 'General'}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-auto">
                                    <button className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                        Profile
                                    </button>
                                    <button 
                                        onClick={() => onNext({ doctor: doc })}
                                        className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        Select &rarr;
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <button onClick={onBack} className="px-6 py-2.5 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 text-slate-700 font-semibold transition-colors">
                &larr; Back
            </button>
        </div>
    );
};

export default DoctorSelect;
