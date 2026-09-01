import React, { useEffect, useState } from 'react';
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';

const OrgStaffManagement = () => {
    const { user, token } = useAuth();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState('All');

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    useEffect(() => {
        async function fetchStaff() {
            if (!token || !orgVritanId) return;
            setLoading(true);
            try {
                const response = await fetch(`${API_BASE}/api/v1/organizations/${orgVritanId}/staff`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const resJson = await response.json();
                if (!response.ok) throw new Error(parseFastApiDetail(resJson));
                setStaff(resJson.data?.staff || []);
            } catch (err) {
                console.error("Staff fetch error", err);
                setError(err.message || "Failed to load staff list.");
            } finally {
                setLoading(false);
            }
        }
        fetchStaff();
    }, [token, orgVritanId]);

    const filteredStaff = filter === 'All' ? staff : staff.filter(s => s.role === filter);

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="staff" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Staff Management</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage organizational roles, departments, and access levels.</p>
                    </div>
                    <button className="px-6 py-2 bg-indigo-600 font-bold text-white rounded-xl shadow-sm hover:bg-indigo-700 active:scale-95 transition-all">
                        + Add Staff Member
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                        <div className="border-b p-4 flex gap-2">
                            {['All', 'Doctor', 'Pharmacist', 'Lab Tech', 'Admin'].map(role => (
                                <button 
                                    key={role}
                                    onClick={() => setFilter(role)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                        filter === role ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-0">
                            {loading ? (
                                <div className="flex items-center justify-center h-48">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500 font-bold">
                                    ⚠️ {error}
                                </div>
                            ) : filteredStaff.length === 0 ? (
                                <div className="p-16 text-center space-y-4">
                                    <div className="text-4xl">👥</div>
                                    <h3 className="text-lg font-bold text-slate-800">No Staff Members Found</h3>
                                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                                        No staff members matching the role "{filter}" are currently assigned to this organization.
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr className="text-xs uppercase tracking-wider text-slate-500">
                                            <th className="px-6 py-4 font-bold border-b">Name</th>
                                            <th className="px-6 py-4 font-bold border-b">Role</th>
                                            <th className="px-6 py-4 font-bold border-b">Department</th>
                                            <th className="px-6 py-4 font-bold border-b">Status</th>
                                            <th className="px-6 py-4 font-bold border-b text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStaff.map((member) => (
                                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                                            {member.name ? member.name.charAt(0) : "S"}
                                                        </div>
                                                        <span className="font-bold text-slate-800">{member.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-600">{member.role}</td>
                                                <td className="px-6 py-4 text-slate-500">{member.department}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        member.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {member.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm">Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OrgStaffManagement;
