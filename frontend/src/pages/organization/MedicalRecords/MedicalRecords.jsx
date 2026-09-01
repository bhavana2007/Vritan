import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../services/api';
import { Search, MapPin, Calendar, FileText, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';

const OrgAdminMedicalRecords = () => {
    const { user, token } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const limit = 20;

    const recordTypes = ["Prescription", "Lab Report", "Clinical Note", "Discharge Summary"];

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

    const fetchRecords = async (query = '', branch = '', type = '', pageNum = 1) => {
        setLoading(true);
        setError('');
        try {
            if (!user?.organization_id) return;
            const offset = (pageNum - 1) * limit;
            let url = `/organizations/${user.organization_id}/medical-records?limit=${limit}&offset=${offset}`;
            if (query) url += `&search=${query}`;
            if (branch) url += `&branch_id=${branch}`;
            if (type) url += `&record_type=${type}`;
            
            const response = await api.get(url);
            setRecords(response.data.data.records || []);
            setTotal(response.data.data.total || 0);
        } catch (err) {
            console.error("Failed to fetch medical records", err);
            setError('Unable to load medical records. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(1);
            fetchRecords(searchQuery, selectedBranch, selectedType, 1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, selectedBranch, selectedType]);

    useEffect(() => {
        if (page > 1) {
            fetchRecords(searchQuery, selectedBranch, selectedType, page);
        }
    }, [page]);

    const handleViewRecord = async (record) => {
        try {
            const response = await api.get(record.view_url, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('target', '_blank');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error("Failed to view record", err);
            alert("Failed to view this record. It might have been deleted or is inaccessible.");
        }
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="medical-records" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Medical Records</h1>
                        <p className="text-slate-500 text-xs mt-1">Securely view medical records belonging to your organization's patients.</p>
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
                                placeholder="Search by patient name, UHID, notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Branches</option>
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Types</option>
                                {recordTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
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
                                    <th className="px-6 py-4 font-semibold">Record Details</th>
                                    <th className="px-6 py-4 font-semibold">Branch</th>
                                    <th className="px-6 py-4 font-semibold">Uploaded By</th>
                                    <th className="px-6 py-4 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            <div className="flex justify-center items-center">
                                                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading records...
                                            </div>
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-lg font-medium text-gray-900">No medical records found</p>
                                            <p className="mt-1">Try adjusting your filters or search query.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{record.patient_name}</div>
                                                <div className="text-xs text-gray-500">{record.patient_uid}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                                    <span className="font-medium">{record.record_type}</span>
                                                </div>
                                                {record.uploaded_at && (
                                                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {new Date(record.uploaded_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {record.notes && <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{record.notes}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-gray-700">
                                                    <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                                                    {record.branch_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.uploaded_by_name}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleViewRecord(record)}
                                                    className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Securely"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
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
                                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} records
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

export default OrgAdminMedicalRecords;
