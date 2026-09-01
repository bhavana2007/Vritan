import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../services/api';
import { Search, MapPin, Calendar, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';

const OrgAdminPatients = () => {
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const limit = 20;

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                if (user?.organization_id) {
                    const response = await api.get(`/organizations/${user.organization_id}/branches`);
                    setBranches(response.data.data || []);
                }
            } catch (err) {
                console.error("Failed to load branches", err);
            }
        };
        fetchBranches();
    }, [user]);

    const fetchPatients = async (query = '', branch = '', pageNum = 1) => {
        setLoading(true);
        setError('');
        try {
            if (!user?.organization_id) return;
            const offset = (pageNum - 1) * limit;
            let url = `/organizations/${user.organization_id}/patients?limit=${limit}&offset=${offset}`;
            if (query) url += `&search=${query}`;
            if (branch) url += `&branch_id=${branch}`;
            
            const response = await api.get(url);
            setPatients(response.data.data.patients || []);
            setTotal(response.data.data.total || 0);
        } catch (err) {
            console.error("Failed to fetch patients", err);
            setError('Unable to load patient data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(1);
            fetchPatients(searchQuery, selectedBranch, 1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedBranch]);

    useEffect(() => {
        if (page > 1) {
            fetchPatients(searchQuery, selectedBranch, page);
        }
    }, [page]);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleBranchChange = (e) => {
        setSelectedBranch(e.target.value);
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="patients" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Patients</h1>
                        <p className="text-slate-500 text-xs mt-1">Manage and view patients associated with your organization.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name, UHID, mobile..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="w-full md:w-64">
                            <select
                                value={selectedBranch}
                                onChange={handleBranchChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Branches</option>
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Patient</th>
                                    <th className="px-6 py-4 font-semibold">Contact</th>
                                    <th className="px-6 py-4 font-semibold">Branch</th>
                                    <th className="px-6 py-4 font-semibold">Last Visit</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            <div className="flex justify-center items-center">
                                                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading patients...
                                            </div>
                                        </td>
                                    </tr>
                                ) : patients.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            No patients found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    patients.map((patient) => (
                                        <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{patient.full_name}</div>
                                                <div className="text-xs text-gray-500">{patient.patient_uid}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>{patient.mobile || 'N/A'}</div>
                                                <div className="text-xs text-gray-500">{patient.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-gray-700">
                                                    <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                                                    {patient.branch_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-gray-700">
                                                    <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                                    {patient.latest_appointment_date !== 'N/A' ? patient.latest_appointment_date : 'No visits'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    patient.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                    patient.status === 'Requested' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {patient.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {!loading && total > 0 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} patients
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= total}
                                    className="p-1.5 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OrgAdminPatients;
