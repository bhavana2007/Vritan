import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { organizationApi } from '../api/organizationApi';
import { useAuth } from '../hooks/useAuth';



const DoctorTransferConfirm = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [status, setStatus] = useState("loading"); // loading, success, error
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Invalid or missing transfer token.");
            return;
        }
        
        if (!user) {
            setStatus("error");
            setMessage("You must be logged in to confirm this transfer.");
            return;
        }

        const confirmTransfer = async () => {
            try {
                // Determine orgId from user context
                const orgId = user.organization_vritan_id;
                if (!orgId) {
                    throw new Error("Organization information not available in your profile.");
                }

                await organizationApi.confirmDoctorTransfer(orgId, { token });
                setStatus("success");
                setMessage("Your transfer has been successfully confirmed. You have been assigned to the new branch.");
            } catch (err) {
                setStatus("error");
                setMessage(err.response?.data?.detail || err.message || "Failed to confirm transfer.");
            }
        };

        confirmTransfer();
    }, [token, user]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">

            <main className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full text-center">
                    {status === "loading" && (
                        <div className="space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                            <h2 className="text-xl font-bold text-slate-800">Processing Transfer...</h2>
                            <p className="text-sm text-slate-500">Please wait while we confirm your branch transfer.</p>
                        </div>
                    )}
                    
                    {status === "success" && (
                        <div className="space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                                ✓
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">Transfer Confirmed!</h2>
                            <p className="text-sm text-slate-500">{message}</p>
                            <button 
                                onClick={() => navigate('/dashboard')}
                                className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow transition w-full"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    )}
                    
                    {status === "error" && (
                        <div className="space-y-4">
                            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                                ✕
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">Transfer Failed</h2>
                            <p className="text-sm text-rose-600 p-3 bg-rose-50 rounded-lg">{message}</p>
                            
                            {!user && (
                                <button 
                                    onClick={() => navigate('/login', { state: { returnTo: `/doctor/transfer-confirm?token=${token}` } })}
                                    className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow transition w-full"
                                >
                                    Log In to Continue
                                </button>
                            )}
                            {user && (
                                <button 
                                    onClick={() => navigate('/dashboard')}
                                    className="mt-4 px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition w-full"
                                >
                                    Return to Dashboard
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </main>

        </div>
    );
};

export default DoctorTransferConfirm;
