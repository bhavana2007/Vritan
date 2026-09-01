import React, { useState } from 'react';
import LabSidebar from '../components/LabSidebar';

const LabResultWorkspace = () => {
    const [results, setResults] = useState([
        { id: 1, name: 'Total Cholesterol', value: '', unit: 'mg/dL', refRange: '< 200', flag: 'Normal' },
        { id: 2, name: 'LDL Cholesterol', value: '', unit: 'mg/dL', refRange: '< 100', flag: 'Normal' },
        { id: 3, name: 'HDL Cholesterol', value: '', unit: 'mg/dL', refRange: '> 40', flag: 'Normal' },
        { id: 4, name: 'Triglycerides', value: '', unit: 'mg/dL', refRange: '< 150', flag: 'Normal' }
    ]);

    const handleValueChange = (id, newValue) => {
        setResults(results.map(r => r.id === id ? { ...r, value: newValue } : r));
    };

    const handleFlagChange = (id, newFlag) => {
        setResults(results.map(r => r.id === id ? { ...r, flag: newFlag } : r));
    };

    const hasCritical = results.some(r => r.flag === 'Critical');

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <LabSidebar currentPage="results" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Result Entry Workspace</h1>
                        <p className="text-slate-500 text-sm mt-1">Input structured diagnostic data for AI processing.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-160px)]">
                        <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-4 flex justify-between items-center">
                            <div>
                                <h2 className="font-bold text-indigo-900 text-lg">Lipid Profile</h2>
                                <p className="text-indigo-700 text-sm">Order LAB-101 • John Doe</p>
                            </div>
                            <span className="bg-indigo-200 text-indigo-900 text-[10px] font-black uppercase px-2 py-1 rounded">Processing</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                                        <th className="px-6 py-4 font-bold border-b">Parameter Name</th>
                                        <th className="px-6 py-4 font-bold border-b w-32">Value</th>
                                        <th className="px-6 py-4 font-bold border-b w-24">Unit</th>
                                        <th className="px-6 py-4 font-bold border-b w-32">Ref Range</th>
                                        <th className="px-6 py-4 font-bold border-b w-40">Flag</th>
                                        <th className="px-6 py-4 font-bold border-b">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map((res) => (
                                        <tr key={res.id} className={`hover:bg-slate-50/50 transition-colors ${res.flag === 'Critical' ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-6 py-4 font-bold text-slate-800">{res.name}</td>
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="text" 
                                                    value={res.value}
                                                    onChange={(e) => handleValueChange(res.id, e.target.value)}
                                                    className="w-full p-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-teal-500 font-mono font-bold text-slate-700" 
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{res.unit}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500 font-mono">{res.refRange}</td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={res.flag}
                                                    onChange={(e) => handleFlagChange(res.id, e.target.value)}
                                                    className={`w-full p-2 border rounded-lg outline-none text-sm font-bold cursor-pointer transition-colors ${
                                                        res.flag === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        res.flag === 'High' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                        res.flag === 'Low' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-red-50 text-red-700 border-red-300 animate-pulse'
                                                    }`}
                                                >
                                                    <option value="Normal">Normal</option>
                                                    <option value="High">High</option>
                                                    <option value="Low">Low</option>
                                                    <option value="Critical">Critical ⚠️</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input type="text" placeholder="Optional notes" className="w-full p-2 border border-transparent hover:border-slate-300 rounded-lg bg-transparent hover:bg-white outline-none focus:border-teal-500 text-sm transition-colors" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-50 border-t p-6 flex justify-between items-center z-10 shadow-lg relative">
                            <div>
                                {hasCritical && (
                                    <div className="flex items-center gap-3 animate-slide-right">
                                        <span className="flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <p className="text-sm font-bold text-red-600">CRITICAL RESULT: High-priority notification will be sent to the responsible doctor.</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <button className="px-6 py-3 border border-slate-300 font-bold text-slate-600 rounded-xl hover:bg-white">Save Draft</button>
                                <button className={`px-8 py-3 font-bold text-white rounded-xl shadow-sm transition-transform active:scale-95 ${
                                    hasCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                                }`}>
                                    Submit for Verification
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default LabResultWorkspace;
