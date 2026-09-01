import React, { useEffect, useState } from 'react';
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';
import { organizationApi } from '../api/organizationApi';

const HospitalBranches = () => {
    const { user } = useAuth();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    // Create Branch state
    const [showModal, setShowModal] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [createdBranchId, setCreatedBranchId] = useState(null);
    const [otp, setOtp] = useState("");
    
    // Branch fields
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    
    // Branch admin fields
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminMobile, setAdminMobile] = useState("");
    
    const [submitting, setSubmitting] = useState(false);

    const [confirmModal, setConfirmModal] = useState(null); // { branchId, currentStatus, name }

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    const fetchBranches = async () => {
        if (!orgVritanId) return;
        try {
            const res = await organizationApi.getBranches(orgVritanId);
            if (res.success !== false) {
                setBranches(res.data || []);
            }
        } catch (err) {
            setError(err.message || "Failed to load branches");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, [orgVritanId]);

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await organizationApi.createBranch(orgVritanId, {
                name,
                address,
                phone,
                email,
                latitude,
                longitude,
                admin_name: adminName,
                admin_email: adminEmail,
                admin_mobile: adminMobile
            });
            if (res.success !== false) {
                setCreatedBranchId(res.data?.id || res.id);
                setShowModal(false);
                setShowOtpModal(true);
            }
        } catch (err) {
            alert(err.message || "Failed to create branch");
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await organizationApi.verifyBranchCreationOtp(orgVritanId, createdBranchId, { otp });
            if (res.success !== false) {
                setShowOtpModal(false);
                setName("");
                setAddress("");
                setPhone("");
                setEmail("");
                setLatitude("");
                setLongitude("");
                setAdminName("");
                setAdminEmail("");
                setAdminMobile("");
                setOtp("");
                fetchBranches();
                alert("Branch application successfully authorized and is now pending Super Admin approval.");
            }
        } catch (err) {
            alert(err.message || "Failed to verify OTP");
        } finally {
            setSubmitting(false);
        }
    };

    const executeToggleStatus = async () => {
        if (!confirmModal) return;
        const nextStatus = confirmModal.currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        try {
            await organizationApi.updateBranch(orgVritanId, confirmModal.branchId, { status: nextStatus });
            setConfirmModal(null);
            fetchBranches();
        } catch (err) {
            alert(err.message || "Failed to toggle branch status");
        }
    };

    const handleToggleStatus = (branchId, currentStatus, name) => {
        setConfirmModal({ branchId, currentStatus, name });
    };

    const inputCls = "w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-emerald-500 text-sm";
    const labelCls = "block text-xs font-bold text-slate-600 mb-1";

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <OrgAdminSidebar currentPage="branches" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-slate-900 px-8 py-5 flex justify-between items-center shadow-md z-10 text-white">
                    <div>
                        <h1 className="text-2xl font-bold">Branch Management</h1>
                        <p className="text-slate-400 text-xs mt-1">Configure and manage physical hospital locations.</p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md"
                    >
                        + Create Branch
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
                            📍 No active branches found. Create your first branch to allocate departments and staff.
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {branches.map((b) => (
                                <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-slate-800">{b.name}</h3>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                                            b.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                                        }`}>
                                            {b.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-1">
                                        <p><strong>Address:</strong> {b.address || "N/A"}</p>
                                        <p><strong>Phone:</strong> {b.phone || "N/A"}</p>
                                        <p><strong>Email:</strong> {b.email || "N/A"}</p>
                                    </div>
                                    
                                    {b.branch_admin ? (
                                        <div className="text-xs p-2 rounded-lg border bg-blue-50 text-blue-700 border-blue-200">
                                            <strong>Branch Admin:</strong> {b.branch_admin.name} ({b.branch_admin.email})
                                        </div>
                                    ) : (
                                        <div className="text-xs p-2 rounded-lg border bg-slate-50 text-slate-500 border-slate-200">
                                            <strong>Branch Admin:</strong> None assigned
                                        </div>
                                    )}

                                    <div className="pt-4 border-t flex justify-between gap-2">
                                        <button
                                            onClick={() => handleToggleStatus(b.id, b.status, b.name)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition border w-full ${
                                                b.status === "ACTIVE"
                                                    ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                            }`}
                                        >
                                            {b.status === "ACTIVE" ? "Disable Branch" : "Enable Branch"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold">Add New Branch</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg">×</button>
                        </header>
                        <form onSubmit={handleCreateBranch} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <h4 className="text-sm font-bold text-slate-800 border-b pb-2">1. Branch Details</h4>
                            <div>
                                <label className={labelCls}>Branch Name *</label>
                                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Hyderabad Hitech City" />
                            </div>
                            <div>
                                <label className={labelCls}>Address *</label>
                                <textarea required value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls + " h-16 resize-none"} placeholder="Full physical address..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Phone</label>
                                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91..." />
                                </div>
                                <div>
                                    <label className={labelCls}>Official Email *</label>
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="branch@hospital.com" />
                                </div>
                            </div>
                            
                            <h4 className="text-sm font-bold text-slate-800 border-b pb-2 mt-6">2. Branch Admin Details</h4>
                            <p className="text-xs text-slate-500 mb-2">The Branch Admin must be a distinct user from the Main Admin.</p>
                            <div>
                                <label className={labelCls}>Admin Full Name *</label>
                                <input type="text" required value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputCls} placeholder="e.g. Rahul Sharma" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Admin Email *</label>
                                    <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputCls} placeholder="admin@branch.com" />
                                </div>
                                <div>
                                    <label className={labelCls}>Admin Mobile *</label>
                                    <input type="tel" required value={adminMobile} onChange={(e) => setAdminMobile(e.target.value)} className={inputCls} placeholder="+91..." />
                                </div>
                            </div>

                            <h4 className="text-sm font-bold text-slate-800 border-b pb-2 mt-6">3. Registered By</h4>
                            <div className="bg-slate-50 p-3 rounded-lg border">
                                <p className="text-xs text-slate-600"><strong>Main Admin:</strong> {user?.name}</p>
                                <p className="text-xs text-slate-600"><strong>Email:</strong> {user?.email}</p>
                            </div>

                            <footer className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow disabled:opacity-50">
                                    {submitting ? "Sending OTP..." : "Continue"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* OTP Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold">Authorize Branch Creation</h3>
                            <button onClick={() => setShowOtpModal(false)} className="text-slate-400 hover:text-white text-lg">×</button>
                        </header>
                        <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
                            <p className="text-sm text-slate-600 mb-4">
                                An OTP has been sent to your registered email <strong>{user?.email}</strong>. 
                                Please enter it below to authorize this branch application.
                            </p>
                            <div>
                                <label className={labelCls}>Enter OTP *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={otp} 
                                    onChange={(e) => setOtp(e.target.value)} 
                                    className={`${inputCls} text-center tracking-widest text-lg font-mono`}
                                    placeholder="• • • • • •" 
                                    maxLength={6}
                                />
                            </div>
                            <footer className="pt-4 border-t flex justify-end gap-3">
                                <button type="button" onClick={() => setShowOtpModal(false)} className="px-5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                                <button type="submit" disabled={submitting || otp.length < 4} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow disabled:opacity-50">
                                    {submitting ? "Verifying..." : "Verify & Submit"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold">
                                {confirmModal.currentStatus === "ACTIVE" ? "Disable Branch?" : "Enable Branch?"}
                            </h3>
                            <button onClick={() => setConfirmModal(null)} className="text-slate-400 hover:text-white text-lg">×</button>
                        </header>
                        <div className="p-6 space-y-4 text-sm text-slate-700">
                            {confirmModal.currentStatus === "ACTIVE" ? (
                                <>
                                    <p>Are you sure you want to disable <strong>{confirmModal.name}</strong>?</p>
                                    <p className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200">
                                        This will temporarily deactivate this branch and prevent branch-level users from accessing branch operations. Patients will no longer be able to book appointments at this branch.
                                    </p>
                                </>
                            ) : (
                                <p>Are you sure you want to re-enable <strong>{confirmModal.name}</strong>? Branch operations will resume immediately.</p>
                            )}
                            <footer className="pt-4 flex justify-end gap-3">
                                <button onClick={() => setConfirmModal(null)} className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
                                    Cancel
                                </button>
                                <button onClick={executeToggleStatus} className={`px-6 py-2 text-white font-bold rounded-xl shadow transition ${
                                    confirmModal.currentStatus === "ACTIVE" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                                }`}>
                                    {confirmModal.currentStatus === "ACTIVE" ? "Disable Branch" : "Enable Branch"}
                                </button>
                            </footer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalBranches;
