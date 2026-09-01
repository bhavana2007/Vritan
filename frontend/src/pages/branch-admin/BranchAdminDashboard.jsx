import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

const BranchAdminDashboard = () => {
    const { user, logout } = useAuth();
    
    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <div className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex h-full">
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-black text-white tracking-tight">Branch Admin</h2>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Portal</p>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl font-bold">
                        Dashboard
                    </a>
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white transition">
                        Logout
                    </button>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white px-8 py-5 flex justify-between items-center shadow-sm z-10 border-b">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
                        <p className="text-slate-500 text-sm mt-1">Welcome, {user?.full_name || user?.name || "Branch Admin"}</p>
                    </div>
                </header>
                
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <h3 className="text-sm font-bold text-slate-500 uppercase">Today's Appointments</h3>
                            <p className="text-3xl font-black text-slate-800 mt-2">0</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <h3 className="text-sm font-bold text-slate-500 uppercase">Active Doctors</h3>
                            <p className="text-3xl font-black text-slate-800 mt-2">0</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <h3 className="text-sm font-bold text-slate-500 uppercase">Total Patients</h3>
                            <p className="text-3xl font-black text-slate-800 mt-2">0</p>
                        </div>
                    </div>
                    
                    <div className="mt-8 bg-white p-12 rounded-2xl border text-center text-slate-500 max-w-lg mx-auto shadow-sm">
                        📍 This is your isolated branch portal. Operations here only affect your assigned branch.
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BranchAdminDashboard;
