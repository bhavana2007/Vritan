import React, { useState, useEffect } from 'react';
import { appointmentsApi } from '../../api/appointments';

const BranchSelect = ({ data, onNext, onBack }) => {
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBranches = async () => {
            if (!data.hospital?.id) {
                setError("Hospital not found. Please go back and select a hospital.");
                setIsLoading(false);
                return;
            }
            try {
                const res = await appointmentsApi.getBranches(data.hospital.id);
                setBranches(res || []);
                
                // Intentionally NOT auto-proceeding to ensure user sees the hierarchy as requested.
            } catch (err) {
                console.error(err);
                setError("Failed to load branches.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchBranches();
    }, [data.hospital, onNext]);

    if (isLoading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Loading branches...</div>;
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto py-6">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 mb-6">
                    {error}
                </div>
                <button onClick={onBack} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium">Back</button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-extrabold text-slate-900">Select a Branch</h2>
                <span className="text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full text-sm">for {data.hospital?.name}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {branches.length === 0 ? (
                    <div className="col-span-full p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                        <span className="text-4xl block mb-2">🏢</span>
                        <p className="text-slate-600 font-medium">No branches available for this organization.</p>
                    </div>
                ) : (
                    branches.map(branch => (
                        <div 
                            key={branch.id} 
                            onClick={() => onNext({ branch })}
                            className="bg-white border border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">{branch.name}</h3>
                                {branch.distance && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">{branch.distance}</span>}
                            </div>
                            <p className="text-slate-500 text-sm mb-4 leading-relaxed line-clamp-2">{branch.address || branch.city}</p>
                            
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">{branch.doctors_available ? `Doctors Available: ${branch.doctors_available}` : 'Select to view doctors'}</span>
                                <span className="text-blue-600 font-bold group-hover:translate-x-1 transition-transform">Select &rarr;</span>
                            </div>
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

export default BranchSelect;
