import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../services/api';
import { Search, MapPin, Phone, Mail, Building, Activity } from 'lucide-react';
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';

const OrgAdminLaboratories = () => {
    const { user } = useAuth();
    const [laboratories, setLaboratories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const fetchLaboratories = async () => {
            setLoading(true);
            setError('');
            try {
                if (!user?.organization_id) return;
                const response = await api.get(`/organizations/${user.organization_id}/laboratories`);
                setLaboratories(response.data.data.laboratories || []);
                setTotal(response.data.data.total || 0);
            } catch (err) {
                console.error("Failed to fetch laboratories", err);
                setError('Unable to load laboratory data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchLaboratories();
    }, [user]);

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="laboratories" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Laboratories</h1>
                        <p className="text-slate-500 text-xs mt-1">Manage laboratories configured for your organization.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

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
                                    <th className="px-6 py-4 font-semibold">Laboratory</th>
                                    <th className="px-6 py-4 font-semibold">Contact</th>
                                    <th className="px-6 py-4 font-semibold">License / ID</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                            <div className="flex justify-center items-center">
                                                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                Loading laboratories...
                                            </div>
                                        </td>
                                    </tr>
                                ) : laboratories.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-lg font-medium text-gray-900">No laboratories configured</p>
                                            <p className="mt-1">There are no laboratory services configured for this organization.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    laboratories.map((lab) => (
                                        <tr key={lab.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{lab.name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {lab.phone && <div className="flex items-center text-gray-700 mb-1"><Phone className="w-3 h-3 mr-2" />{lab.phone}</div>}
                                                {lab.email && <div className="flex items-center text-gray-500 text-xs"><Mail className="w-3 h-3 mr-2" />{lab.email}</div>}
                                                {!lab.phone && !lab.email && <span className="text-gray-400">N/A</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                                                    {lab.license_number}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    lab.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {lab.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OrgAdminLaboratories;
