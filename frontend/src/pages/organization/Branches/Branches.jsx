import React, { useState, useEffect } from 'react';
import { organizationApi } from '../../../api/organizationApi';

const Branches = () => {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const orgId = 1; // From Auth/Context

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const data = await organizationApi.getBranches(orgId);
                setBranches(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBranches();
    }, [orgId]);

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Organization Branches</h1>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition">
                    + Add Branch
                </button>
            </header>

            {loading ? (
                <div className="p-12 text-center text-gray-500 animate-pulse">Loading branches...</div>
            ) : error ? (
                <div className="p-12 text-center text-red-500 bg-red-50 rounded-lg border border-red-100">
                    <p>Failed to load branches: {error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-md">Retry</button>
                </div>
            ) : branches.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No branches found</h3>
                    <p className="text-gray-500 mt-1">Get started by creating a new branch.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {branches.map(branch => (
                                <tr key={branch.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{branch.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{branch.address || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {branch.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                                        <button className="text-red-600 hover:text-red-900">Disable</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Branches;
