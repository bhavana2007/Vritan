import React, { useEffect, useState } from 'react';
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';
import { organizationApi } from '../api/organizationApi';

const HospitalDepartments = () => {
    const { user } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Add Dept state
    const [showModal, setShowModal] = useState(false);
    const [branchId, setBranchId] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    const fetchData = async () => {
        if (!orgVritanId) return;
        try {
            const [deptRes, branchRes] = await Promise.all([
                organizationApi.getDepartments(orgVritanId),
                organizationApi.getBranches(orgVritanId)
            ]);
            
            if (deptRes.success !== false) setDepartments(deptRes.data || []);
            if (branchRes.success !== false) {
                const activeBranches = (branchRes.data || []).filter(b => b.status === "ACTIVE");
                setBranches(activeBranches);
                if (activeBranches.length > 0) setBranchId(activeBranches[0].id.toString());
            }
        } catch (err) {
            setError(err.message || "Failed to load departments.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [orgVritanId]);

    const handleCreateDepartment = async (e) => {
        e.preventDefault();
        if (!branchId) {
            alert("Please select a branch first");
            return;
        }
        setSubmitting(true);
        try {
            const res = await organizationApi.createDepartment(orgVritanId, {
                branch_id: parseInt(branchId),
                name,
                description
            });
            if (res.success !== false) {
                setShowModal(false);
                setName("");
                setDescription("");
                fetchData();
            }
        } catch (err) {
            alert(err.message || "Failed to create department");
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchiveDepartment = async (deptId, currentActive) => {
        try {
            await organizationApi.updateDepartment(orgVritanId, deptId, { is_active: !currentActive });
            fetchData();
        } catch (err) {
            alert("Failed to archive department");
        }
    };

    const inputCls = "w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-emerald-500 text-sm bg-white";
    const labelCls = "block text-xs font-bold text-slate-600 mb-1";

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="departments" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-slate-900 px-8 py-5 flex justify-between items-center shadow-md z-10 text-white">
                    <div>
                        <h1 className="text-2xl font-bold">Department Management</h1>
                        <p className="text-slate-400 text-xs mt-1">Configure clinical specialties across hospital branches.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        disabled={branches.length === 0}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50"
                    >
                        + Create Department
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border">{error}</div>
                    ) : branches.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500 max-w-md mx-auto mt-12 shadow-sm">
                            ⚠️ A verified and active branch is required before configuring clinical departments. Please add a branch first.
                        </div>
                    ) : departments.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border text-center text-slate-500 max-w-md mx-auto mt-12 shadow-sm">
                            📂 No departments found. Click the button above to add specialties like Cardiology, Neurology, or Emergency Care.
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto bg-white border rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 text-xs font-bold border-b">
                                    <tr>
                                        <th className="px-6 py-4">Department Name</th>
                                        <th className="px-6 py-4">Branch Location</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {departments.map((d) => (
                                        <tr key={d.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4 font-bold text-slate-800">{d.name}</td>
                                            <td className="px-6 py-4">{d.branch_name}</td>
                                            <td className="px-6 py-4 text-slate-400">{d.description || "No description provided."}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    d.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                                                }`}>
                                                    {d.is_active ? "Active" : "Archived"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleArchiveDepartment(d.id, d.is_active)}
                                                    className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition"
                                                >
                                                    {d.is_active ? "Archive" : "Unarchive"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {/* Create Department Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold">Add Department</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">×</button>
                        </header>
                        <form onSubmit={handleCreateDepartment} className="p-6 space-y-4">
                            <div>
                                <label className={labelCls}>Branch Scope *</label>
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className={inputCls}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Department Name *</label>
                                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Cardiology, Neurology" />
                            </div>
                            <div>
                                <label className={labelCls}>Description</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Brief specialty focus details..." />
                            </div>
                            <footer className="pt-4 border-t flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow disabled:opacity-50">
                                    {submitting ? "Creating..." : "Save Department"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalDepartments;
