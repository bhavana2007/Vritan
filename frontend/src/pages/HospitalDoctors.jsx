import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from "../hooks/useAuth";
import OrgAdminSidebar from '../components/OrgAdminSidebar';
import { organizationApi } from '../api/organizationApi';

const HospitalDoctors = () => {
    const { user } = useAuth();
    const [doctors, setDoctors] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [activeTab, setActiveTab] = useState("active");
    const [branches, setBranches] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Invite Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmailOrId, setInviteEmailOrId] = useState("");
    const [inviteRole, setInviteRole] = useState("doctor");
    const [inviteDesignation, setInviteDesignation] = useState("");
    const [inviteBranchId, setInviteBranchId] = useState("");
    const [inviteDeptId, setInviteDeptId] = useState("");
    const [employmentType, setEmploymentType] = useState("EMPLOYED");
    const [inviting, setInviting] = useState(false);

    // Transfer Modal
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [transferBranchId, setTransferBranchId] = useState("");
    const [transferDeptId, setTransferDeptId] = useState("");
    const [transferring, setTransferring] = useState(false);

    // Actions Menu State
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);

    const orgVritanId = user?.organization_vritan_id || "demo-vritan-id";

    const fetchData = async () => {
        if (!orgVritanId) return;
        try {
            setLoading(true);
            const [docRes, branchRes, deptRes, inviteRes] = await Promise.all([
                organizationApi.getDoctors(orgVritanId),
                organizationApi.getBranches(orgVritanId),
                organizationApi.getDepartments(orgVritanId),
                organizationApi.getInvitations(orgVritanId)
            ]);

            if (docRes.success !== false) {
                setDoctors(docRes.data || []);
            }
            if (inviteRes.success !== false) {
                const pendingInvites = (inviteRes.data || []).filter(
                    inv => String(inv.status || "").toUpperCase() === "PENDING"
                );
                setInvitations(pendingInvites);
            }
            if (branchRes.success !== false) {
                const activeBranches = (branchRes.data || []).filter(b => b.status === "ACTIVE");
                setBranches(activeBranches);
                if (activeBranches.length > 0) {
                    setInviteBranchId(activeBranches[0].id.toString());
                    setTransferBranchId(activeBranches[0].id.toString());
                }
            }
            if (deptRes.success !== false) {
                const activeDepts = (deptRes.data || []).filter(d => d.is_active);
                setDepartments(activeDepts);
                if (activeDepts.length > 0) {
                    setInviteDeptId(activeDepts[0].id.toString());
                    setTransferDeptId(activeDepts[0].id.toString());
                }
            }
        } catch (err) {
            setError(err.message || "Unable to load doctor affiliations. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [orgVritanId]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const handleInviteDoctor = async (e) => {
        e.preventDefault();
        setInviting(true);
        try {
            const res = await organizationApi.inviteMember(orgVritanId, {
                email_or_id: inviteEmailOrId,
                role: inviteRole,
                branch_id: parseInt(inviteBranchId),
                department_id: inviteDeptId ? parseInt(inviteDeptId) : null,
                employment_type: employmentType,
                designation: inviteDesignation
            });
            if (res.success !== false) {
                const statusType = res.data?.status || res.status;
                if (statusType === "AFFILIATED") {
                    alert(`${inviteRole.charAt(0).toUpperCase() + inviteRole.slice(1)} affiliated successfully.`);
                } else if (statusType === "INVITED") {
                    let alertMsg = "Invitation sent successfully. The member can register using the invitation link. Status: Pending Registration.";
                    if (res.data?.raw_token) {
                        const inviteUrl = `${window.location.origin}/register?invite=${res.data.raw_token}`;
                        navigator.clipboard.writeText(inviteUrl);
                        alertMsg += `\n\nDirect link copied to clipboard:\n${inviteUrl}`;
                    }
                    alert(alertMsg);
                } else {
                    alert(res.message || "Affiliated successfully.");
                }
                setShowInviteModal(false);
                setInviteEmailOrId("");
                setInviteDesignation("");
                setInviteRole("doctor");
                fetchData();
            }
        } catch (err) {
            alert(err.data?.detail || err.message || "Failed to affiliate/invite member.");
        } finally {
            setInviting(false);
        }
    };

    const handleTransferDoctor = async (e) => {
        e.preventDefault();
        if (!selectedDoctor) return;
        
        // Prevent same-assignment transfers
        const destBranchId = parseInt(transferBranchId);
        const destDeptId = transferDeptId ? parseInt(transferDeptId) : null;
        
        if (selectedDoctor.branch_id === destBranchId && (selectedDoctor.department_id || null) === destDeptId) {
            alert("Doctor is already assigned to this branch and department.");
            return;
        }

        setTransferring(true);
        try {
            const res = await organizationApi.transferDoctor(orgVritanId, selectedDoctor.id, {
                to_branch_id: parseInt(transferBranchId),
                department_id: transferDeptId ? parseInt(transferDeptId) : null
            });
            if (res.success !== false) {
                setShowTransferModal(false);
                setSelectedDoctor(null);
                fetchData();
                alert("Transfer request initiated. An email has been sent to the doctor for confirmation.");
            }

        } catch (err) {
            alert(err.message || "Failed to transfer doctor");
        } finally {
            setTransferring(false);
        }
    };

    const handleRemoveDoctor = async (doctorId) => {
        if (!window.confirm("Are you sure you want to remove this doctor's affiliation?")) return;
        try {
            await organizationApi.removeDoctor(orgVritanId, doctorId);
            fetchData();
        } catch (err) {
            alert("Failed to remove doctor affiliation");
        }
    };

    const handleResendInvitation = async (inviteId) => {
        try {
            const res = await organizationApi.resendInvitation(orgVritanId, inviteId);
            let alertMsg = "Invitation resent successfully.";
            if (res.data?.raw_token) {
                const inviteUrl = `${window.location.origin}/register?invite=${res.data.raw_token}`;
                navigator.clipboard.writeText(inviteUrl);
                alertMsg += `\n\nNew direct link copied to clipboard:\n${inviteUrl}`;
            }
            alert(alertMsg);
            fetchData();
        } catch (err) {
            alert(err.data?.detail || err.message || "Failed to resend invitation.");
        }
    };

    const handleCancelInvitation = async (inviteId) => {
        if (!window.confirm("Are you sure you want to cancel this invitation?")) return;
        try {
            await organizationApi.cancelInvitation(orgVritanId, inviteId);
            alert("Invitation cancelled successfully.");
            fetchData();
        } catch (err) {
            alert(err.data?.detail || err.message || "Failed to cancel invitation.");
        }
    };

    const inputCls = "w-full px-4 py-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-blue-500 transition-colors";
    const labelCls = "block text-xs font-semibold text-slate-700 mb-1";

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="doctors" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Doctor Affiliations</h1>
                        <p className="text-slate-500 text-xs mt-1">Affiliate, transfer, and coordinate doctors across branches.</p>
                    </div>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        disabled={branches.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition disabled:opacity-50"
                    >
                        + Affiliate Doctor
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                            <div className="text-sm font-medium">Loading doctors...</div>
                        </div>
                    ) : error ? (
                        <div className="bg-rose-50 text-rose-800 p-4 rounded border border-rose-200 text-sm font-medium">{error}</div>
                    ) : branches.length === 0 ? (
                        <div className="bg-white p-8 rounded border border-slate-200 text-center text-slate-500 max-w-md mx-auto shadow-sm text-sm">
                            ⚠️ An active branch must be configured before affiliating clinical doctors.
                        </div>
                    ) : (
                        <div className="max-w-full w-full bg-white rounded border border-slate-200 shadow-sm flex flex-col">
                            {/* Tabs Header */}
                            <div className="flex border-b border-slate-200 px-4">
                                <button
                                    onClick={() => setActiveTab("active")}
                                    className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                                        activeTab === "active"
                                            ? "border-blue-600 text-blue-700"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Active Doctors ({doctors.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab("pending")}
                                    className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                                        activeTab === "pending"
                                            ? "border-blue-600 text-blue-700"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Pending Invitations ({invitations.length})
                                </button>
                            </div>

                            {/* Active Tab Content */}
                            {activeTab === "active" ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3">Member</th>
                                                <th className="px-6 py-3">Role</th>
                                                <th className="px-6 py-3">Branch</th>
                                                <th className="px-6 py-3">Department</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {doctors.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                                        No active doctors affiliated.
                                                    </td>
                                                </tr>
                                            ) : (
                                                doctors.map((d) => (
                                                    <tr key={d.id} className="h-14 hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-2">
                                                            <div className="font-semibold text-slate-900">{d.name || d.email}</div>
                                                            {d.email && d.name && (
                                                                <div className="text-xs text-slate-500">{d.email}</div>
                                                            )}
                                                            {d.specialization && (
                                                                <div className="text-[10px] text-slate-400 mt-0.5">{d.specialization}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-2">
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-bold uppercase">
                                                                DOCTOR
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-2 text-slate-700">{d.branch_name || "—"}</td>
                                                        <td className="px-6 py-2 text-slate-700">{d.department_name || "—"}</td>
                                                        <td className="px-6 py-2">
                                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium flex w-max items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                                ACTIVE
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-2 text-right relative">
                                                            <button
                                                                onClick={() => setActiveDropdown(activeDropdown === d.id ? null : d.id)}
                                                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                </svg>
                                                            </button>
                                                            
                                                            {activeDropdown === d.id && (
                                                                <div ref={dropdownRef} className="absolute right-6 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1 text-left">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedDoctor(d);
                                                                            setShowTransferModal(true);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                                                    >
                                                                        Transfer Doctor
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            window.location.href = `/org-admin/doctors/${d.id}/schedule`;
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition"
                                                                    >
                                                                        View Schedule
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleRemoveDoctor(d.id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                                                                    >
                                                                        Remove / Deactivate
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3">Member</th>
                                                <th className="px-6 py-3">Role</th>
                                                <th className="px-6 py-3">Branch</th>
                                                <th className="px-6 py-3">Department</th>
                                                <th className="px-6 py-3">Invited By</th>
                                                <th className="px-6 py-3">Expiry</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {invitations.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500 flex flex-col items-center">
                                                        <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mb-2">
                                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                        </div>
                                                        <span className="font-medium text-slate-700">✓ All invitations have been accepted</span>
                                                        <span className="text-xs text-slate-400 mt-1">There are no pending invitations.</span>
                                                    </td>
                                                </tr>
                                            ) : (
                                                invitations.map((inv) => (
                                                    <tr key={inv.id} className="h-14 hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-2">
                                                            <div className="font-semibold text-slate-900">{inv.email}</div>
                                                            {inv.designation && (
                                                                <div className="text-[10px] text-slate-500 mt-0.5">{inv.designation}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-2">
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold uppercase">
                                                                {String(inv.role).replace("_", " ")}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-2 text-slate-700">{inv.branch_name || "—"}</td>
                                                        <td className="px-6 py-2 text-slate-700">{inv.department_name || "—"}</td>
                                                        <td className="px-6 py-2 text-slate-500 text-xs">{inv.created_by_email || "System"}</td>
                                                        <td className="px-6 py-2 text-slate-500 text-xs">
                                                            {new Date(inv.expires_at).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric"
                                                            })}
                                                        </td>
                                                        <td className="px-6 py-2">
                                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                                                                PENDING
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-2 text-right relative">
                                                            <button
                                                                onClick={() => setActiveDropdown(activeDropdown === inv.id ? null : inv.id)}
                                                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                </svg>
                                                            </button>
                                                            
                                                            {activeDropdown === inv.id && (
                                                                <div ref={dropdownRef} className="absolute right-6 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1 text-left">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleResendInvitation(inv.id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                                                    >
                                                                        Resend &amp; Copy Link
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleCancelInvitation(inv.id);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                                                                    >
                                                                        Cancel Invitation
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800">Affiliate / Invite Staff Member</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>
                        <form onSubmit={handleInviteDoctor} className="p-6 space-y-4">
                            <div>
                                <label className={labelCls}>Role / Staff Type *</label>
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="doctor">Doctor</option>
                                    <option value="pharmacist">Pharmacist</option>
                                    <option value="nurse">Nurse</option>
                                    <option value="lab_technician">Lab Technician</option>
                                    <option value="staff">Administrative Staff</option>
                                    <option value="admin">Branch Administrator</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Email or Vritan ID *</label>
                                <input type="text" required value={inviteEmailOrId} onChange={(e) => setInviteEmailOrId(e.target.value)} className={inputCls} placeholder="e.g. member@vritan.com or VR-DOC-XXXXXX" />
                                <p className="text-[10px] text-slate-500 leading-normal mt-1.5">
                                    Existing users with matching role will be affiliated instantly. Otherwise, a secure invitation email will be sent.
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>Assign Branch *</label>
                                <select
                                    value={inviteBranchId}
                                    onChange={(e) => setInviteBranchId(e.target.value)}
                                    className={inputCls}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Assign Department (Optional)</label>
                                <select
                                    value={inviteDeptId}
                                    onChange={(e) => setInviteDeptId(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">No Department Assigned</option>
                                    {departments.filter(d => d.branch_id === parseInt(inviteBranchId)).map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Designation (Optional)</label>
                                <input type="text" value={inviteDesignation} onChange={(e) => setInviteDesignation(e.target.value)} className={inputCls} placeholder="e.g. Senior Consultant" />
                            </div>
                            <div>
                                <label className={labelCls}>Employment Type</label>
                                <select
                                    value={employmentType}
                                    onChange={(e) => setEmploymentType(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="EMPLOYED">Full-time Employed</option>
                                    <option value="VISITING">Visiting Consultant</option>
                                    <option value="CONTRACT">Contract Basis</option>
                                </select>
                            </div>
                            <footer className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={inviting} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition disabled:opacity-50">
                                    {inviting ? "Linking..." : "Affiliate / Invite"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && selectedDoctor && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800">Transfer: {selectedDoctor.name || selectedDoctor.email}</h3>
                            <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>
                        <form onSubmit={handleTransferDoctor} className="p-6 space-y-4">
                            <div>
                                <label className={labelCls}>New Branch Location *</label>
                                <select
                                    value={transferBranchId}
                                    onChange={(e) => setTransferBranchId(e.target.value)}
                                    className={inputCls}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>New Department Assignment</label>
                                <select
                                    value={transferDeptId}
                                    onChange={(e) => setTransferDeptId(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">No Department Assigned</option>
                                    {departments.filter(d => d.branch_id === parseInt(transferBranchId)).map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <footer className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={transferring} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition disabled:opacity-50">
                                    {transferring ? "Initiating..." : "Initiate Transfer"}
                                </button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HospitalDoctors;
