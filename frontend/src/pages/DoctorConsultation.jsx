import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

const DoctorConsultation = () => {
    const { appointmentUid } = useParams();
    const navigate = useNavigate();
    
    // State
    const [isLoading, setIsLoading] = useState(true);
    const [appointment, setAppointment] = useState(null);
    const [patient, setPatient] = useState(null);
    const [records, setRecords] = useState([]);
    const [prescriptions, setPrescriptions] = useState([]);
    const [accessRequest, setAccessRequest] = useState(null);
    
    // Clinical Notes
    const [chiefComplaint, setChiefComplaint] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [clinicalNotes, setClinicalNotes] = useState("");
    const [labOrders, setLabOrders] = useState({ lipid: false, cbc: false, hba1c: false, esr: false });
    
    // AI Summary
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiSummary, setAiSummary] = useState(null);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiSources, setAiSources] = useState([]);
    
    // Document Viewer
    const [viewingDocUrl, setViewingDocUrl] = useState(null);

    // Initial Fetch & Polling
    const fetchContext = async () => {
        try {
            // 1. Fetch appointment details
            const aptData = await apiClient.get('/api/v1/appointments/my-appointments');
            const currentApt = aptData.find(a => a.appointment_uid === appointmentUid || String(a.id) === appointmentUid);
            if (!currentApt) {
                console.error("Appointment not found");
                return;
            }
            setAppointment(currentApt);
            
            // 2. Fetch patient profile
            const patientData = await apiClient.get(`/doctor/patient/${currentApt.patient_id}/full-record`).catch(() => null);
            if (patientData) {
                setPatient(patientData);
                
                // 3. Fetch records if we have access
                const recordsData = await apiClient.get(`/doctor/patient/${currentApt.patient_id}/medical-records`).catch(() => null);
                if (recordsData) {
                    setRecords(recordsData);
                    setAccessRequest({ status: 'approved' });
                } else {
                    // Check access request status
                    const accessData = await apiClient.get(`/doctor/access-requests`);
                    const req = accessData?.find(r => r.patient_id === currentApt.patient_id && (r.status === 'pending' || r.status === 'approved'));
                    setAccessRequest(req || null);
                }
                
                const rxData = await apiClient.get(`/doctor/patient/${currentApt.patient_id}/prescriptions`).catch(() => []);
                setPrescriptions(rxData);
            }
        } catch (err) {
            console.error("Failed to fetch context", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContext();
        const interval = setInterval(fetchContext, 5000);
        return () => clearInterval(interval);
    }, [appointmentUid]);

    // Actions
    const handleRequestAccess = async () => {
        if (!appointment?.patient_id) return;
        try {
            // The backend returns the canonical patient_uid on the appointment object
            const patientUid = appointment?.patient_uid;
            if (!patientUid) {
                alert("Cannot determine patient UID to request access.");
                return;
            }
            const res = await apiClient.post(`/doctor/request-access/${patientUid}`);
            fetchContext();
            if (res && res.message) {
                alert(res.message);
            } else {
                alert("Access request sent.");
            }
        } catch (error) {
            alert(error.message || "Failed to send access request.");
        }
    };

    const handleGenerateAiSummary = async () => {
        if (!aiPrompt.trim() || !appointment?.patient_id) return;
        setIsGeneratingAi(true);
        try {
            const res = await apiClient.post(`/doctor/patient/${appointment.patient_id}/ai-summary`, {
                prompt: aiPrompt
            });
            setAiSummary(res.summary);
            setAiSources(res.sources || []);
        } catch (error) {
            alert(error.response?.data?.detail || "Failed to generate AI summary.");
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleCompleteConsultation = async () => {
        try {
            // Save consultation details to localStorage / state for Prescription Builder to pick up
            const consultationData = {
                appointmentUid,
                chief_complaint: chiefComplaint,
                diagnosis,
                clinical_notes: clinicalNotes,
                labOrders
            };
            localStorage.setItem(`consultation_${appointmentUid}`, JSON.stringify(consultationData));

            // Call complete endpoint
            await apiClient.put(`/api/v1/appointments/${appointmentUid}/complete`);
            
            // Navigate to prescription builder (we assume it exists and handles persistence)
            navigate(`/doctor/prescription-builder/${appointmentUid}`);
        } catch (error) {
            console.error("Failed to complete:", error);
            alert("Failed to complete consultation.");
        }
    };

    if (isLoading) return <div className="p-10 text-center">Loading consultation workspace...</div>;
    if (!appointment) return <div className="p-10 text-center text-red-500">Appointment not found.</div>;

    const hasAccess = accessRequest?.status === 'approved';

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            <header className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/doctor/appointments')} className="text-slate-500 hover:text-slate-800 transition-colors font-medium">
                        ← Back to Queue
                    </button>
                    <div className="h-4 w-px bg-slate-300"></div>
                    <span className="font-mono text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
                        {appointment.token || `APT-${appointmentUid}`}
                    </span>
                    <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                        {appointment.status}
                    </span>
                </div>
            </header>

            <main className="flex-1 p-4 flex gap-4 overflow-hidden">
                {/* Left Panel: Clinical Notes */}
                <div className="w-1/2 flex flex-col bg-white rounded-2xl shadow-sm border p-6 overflow-y-auto">
                    
                    {/* Patient Snapshot */}
                    <div className="bg-slate-50 rounded-xl border p-4 mb-6 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xl flex items-center justify-center">
                                {patient ? patient.full_name.charAt(0) : appointment.patient_name?.charAt(0) || 'P'}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{patient?.full_name || appointment.patient_name || 'Unknown'}</h2>
                                <p className="text-sm text-slate-500 font-medium">
                                    UHID: <span className="font-bold">{appointment.patient_uid || patient?.patient_uid || 'N/A'}</span> • {patient ? `${patient.gender || 'N/A'} • ${patient.blood_group || 'N/A'}` : 'Demographics not available'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="mb-5">
                                <label className="block text-sm font-bold text-slate-800 mb-2">Chief Complaint & HPI</label>
                                <textarea 
                                    value={chiefComplaint}
                                    onChange={(e) => setChiefComplaint(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-20"
                                    placeholder="Enter chief complaint..."
                                ></textarea>
                            </div>

                            <div className="mb-5">
                                <label className="block text-sm font-bold text-slate-800 mb-2">Clinical Examination & Diagnosis</label>
                                <input 
                                    type="text"
                                    value={diagnosis}
                                    onChange={(e) => setDiagnosis(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none mb-3"
                                    placeholder="Primary diagnosis..."
                                />
                                <textarea 
                                    value={clinicalNotes}
                                    onChange={(e) => setClinicalNotes(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none h-24"
                                    placeholder="Examination notes, vitals..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 mt-6 flex justify-end">
                            <button 
                                onClick={handleCompleteConsultation}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all"
                            >
                                Complete Consultation & Open Prescription Builder &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: AI Summary & Records */}
                <div className="w-1/2 flex flex-col bg-white rounded-2xl shadow-sm border overflow-hidden">
                    {!hasAccess ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
                            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl mb-4">🔒</div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Access Restricted</h3>
                            <p className="text-slate-500 text-sm mb-6">You need patient approval to view their medical records and generate AI summaries.</p>
                            
                            {accessRequest?.status === 'pending' ? (
                                <button className="px-6 py-2 bg-amber-500 text-white font-bold rounded-full opacity-70 cursor-not-allowed">
                                    Access Pending Approval...
                                </button>
                            ) : (
                                <button 
                                    onClick={handleRequestAccess}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-sm"
                                >
                                    Request Document Access
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b bg-slate-50">
                                <h3 className="font-bold text-slate-800">AI Clinical Summary</h3>
                                <p className="text-xs text-slate-500">Grounded exclusively in patient records.</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                                {/* AI Chat output */}
                                {aiSummary && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-blue-600 font-bold text-xs uppercase tracking-wider">AI-Assisted Summary</span>
                                        </div>
                                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{aiSummary}</div>
                                        
                                        {aiSources.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-blue-200">
                                                <p className="text-xs font-bold text-slate-600 mb-1">Sources:</p>
                                                <ul className="list-disc pl-4 text-xs text-slate-500">
                                                    {aiSources.map((src, i) => <li key={i}>{src}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Records list */}
                                <div className="mt-4 border-t pt-4">
                                    <h4 className="font-bold text-slate-700 text-sm mb-3">Available Medical Records</h4>
                                    {records.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic">No records available.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {records.map(record => (
                                                <div key={record.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-700">{record.document_title || record.record_type}</p>
                                                        <p className="text-xs text-slate-500">{new Date(record.uploaded_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setViewingDocUrl(record.file_url)}
                                                        className="text-xs font-bold text-blue-600 hover:underline"
                                                    >
                                                        View Document
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t bg-white">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder="E.g., Summarise his diabetes history..."
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                                        onKeyDown={e => e.key === 'Enter' && handleGenerateAiSummary()}
                                    />
                                    <button 
                                        onClick={handleGenerateAiSummary}
                                        disabled={isGeneratingAi || !aiPrompt.trim()}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                                    >
                                        {isGeneratingAi ? 'Generating...' : 'Generate Summary'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Document Viewer Modal */}
            {viewingDocUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl h-full max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-slate-800">Document Viewer</h3>
                            <button onClick={() => setViewingDocUrl(null)} className="text-slate-500 hover:text-slate-800 font-bold text-xl">&times;</button>
                        </div>
                        <div className="flex-1 p-4 bg-slate-100 overflow-auto flex justify-center">
                            {viewingDocUrl.toLowerCase().endsWith('.pdf') ? (
                                <iframe src={viewingDocUrl} className="w-full h-full border-0" title="PDF Document" />
                            ) : (
                                <img src={viewingDocUrl} alt="Medical Document" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorConsultation;
