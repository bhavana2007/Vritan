import React, { useState, useEffect } from 'react';
import { appointmentsApi } from '../../api/appointments';

const getDepartmentIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('cardio')) return '❤️';
    if (lowerName.includes('neuro')) return '🧠';
    if (lowerName.includes('ortho')) return '🦴';
    if (lowerName.includes('pedia')) return '👶';
    if (lowerName.includes('derma')) return '🧴';
    if (lowerName.includes('eye') || lowerName.includes('opthal')) return '👁️';
    if (lowerName.includes('tooth') || lowerName.includes('dent')) return '🦷';
    return '🩺';
};

const DepartmentSelect = ({ data, onNext, onBack }) => {
    const [departments, setDepartments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDepartments = async () => {
            if (!data.branch?.id) {
                setError("Branch not found. Please go back and select a branch.");
                setIsLoading(false);
                return;
            }
            try {
                const res = await appointmentsApi.getDepartments(data.branch.id);
                setDepartments(res || []);
            } catch (err) {
                console.error(err);
                setError("Failed to load departments.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchDepartments();
    }, [data.branch]);

    if (isLoading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Loading departments...</div>;
    }

    if (error) {
        return (
            <div className="max-w-5xl mx-auto py-6">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 mb-6">
                    {error}
                </div>
                <button onClick={onBack} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium">Back</button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-6 animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900">Select Department</h2>
                    <p className="text-slate-500 mt-1 font-medium bg-slate-100 px-3 py-1 rounded-full inline-block text-sm">{data.hospital?.name} &bull; {data.branch?.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                {departments.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                        <span className="text-4xl block mb-2">🩺</span>
                        <p className="text-slate-600 font-medium">No departments available for this branch.</p>
                    </div>
                ) : (
                    departments.map(dept => (
                        <div 
                            key={dept.id}
                            onClick={() => onNext({ department: dept })}
                            className="bg-white border border-slate-200 rounded-2xl p-5 text-center cursor-pointer hover:border-blue-500 hover:shadow-md transition-all hover:-translate-y-1 group"
                        >
                            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{getDepartmentIcon(dept.name)}</div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{dept.name}</h3>
                            {dept.doctors_count !== undefined && (
                                <p className="text-xs text-slate-500 font-medium mb-3">{dept.doctors_count} Doctors</p>
                            )}
                            
                            {dept.earliest_available && (
                                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-700 bg-blue-50 py-1.5 rounded-md border border-blue-100">
                                    Earliest: {dept.earliest_available}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <button 
                onClick={onBack}
                className="px-6 py-2.5 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
                &larr; Back
            </button>
        </div>
    );
};

export default DepartmentSelect;
