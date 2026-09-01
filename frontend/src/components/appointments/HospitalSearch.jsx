import React, { useState, useEffect, useCallback } from 'react';
import { appointmentsApi } from '../../api/appointments';

const HospitalSearch = ({ onNext }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [hospitals, setHospitals] = useState([]);
    const [filteredHospitals, setFilteredHospitals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHospitals = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await appointmentsApi.getOrganizations();
            setHospitals(data || []);
            setFilteredHospitals(data || []);
        } catch (err) {
            console.error("Failed to fetch hospitals:", err);
            setError("Unable to load healthcare organizations. Check your connection or try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHospitals();
    }, [fetchHospitals]);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredHospitals(hospitals);
        } else {
            const lower = searchTerm.toLowerCase();
            setFilteredHospitals(hospitals.filter(h => 
                h.name?.toLowerCase().includes(lower) || 
                h.city?.toLowerCase().includes(lower)
            ));
        }
    }, [searchTerm, hospitals]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        // filtering handled by effect
    };

    const handleClearFilters = () => {
        setSearchTerm('');
    };

    return (
        <div className="max-w-5xl mx-auto py-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Select Healthcare Organization</h2>
            
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="mb-8 flex gap-4">
                <input 
                    type="text" 
                    placeholder="Search by organization name or city..." 
                    className="flex-1 p-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </form>

            {/* Error State */}
            {error && !isLoading && (
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 text-center">
                    <p className="mb-4">{error}</p>
                    <button 
                        onClick={fetchHospitals}
                        className="px-6 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-medium transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-pulse flex flex-col h-[280px]">
                            <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
                            <div className="mt-auto h-10 bg-slate-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredHospitals.length === 0 && (
                <div className="text-center bg-slate-50 border border-slate-200 rounded-2xl p-10 mt-4">
                    <span className="text-5xl block mb-4">🏥</span>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No healthcare organizations found.</h3>
                    <p className="text-slate-500 mb-6">Try changing your search or check back later.</p>
                    <button 
                        onClick={handleClearFilters}
                        className="px-6 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        Clear Search
                    </button>
                </div>
            )}

            {/* Results Grid */}
            {!isLoading && !error && filteredHospitals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredHospitals.map(hospital => {
                        return (
                            <div key={hospital.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col h-full group cursor-pointer" onClick={() => onNext({ hospital })}>
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors">
                                        🏥 {hospital.name}
                                    </h3>
                                </div>
                                
                                <div className="space-y-2 mb-4 flex-1">
                                    <p className="text-slate-600 text-sm flex items-start gap-2">
                                        <span className="shrink-0">📍</span> 
                                        <span>{hospital.address || "Address not provided"}</span>
                                    </p>
                                    <p className="text-slate-600 text-sm flex items-start gap-2">
                                        <span className="shrink-0">📞</span> 
                                        <span>{hospital.phone || "Phone not provided"}</span>
                                    </p>
                                </div>
                                
                                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-end">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onNext({ hospital }); }}
                                        className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1 shrink-0 w-full justify-center"
                                    >
                                        Select Organization &rarr;
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HospitalSearch;
