import React, { useState } from 'react';
import LabSidebar from '../components/LabSidebar';

const SampleCollection = () => {
    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <LabSidebar currentPage="collection" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Sample Collection</h1>
                        <p className="text-slate-500 text-sm mt-1">Record patient sample intake and generate barcodes.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="bg-teal-50 border-b border-teal-100 px-6 py-4 flex justify-between items-center">
                            <h2 className="font-bold text-teal-800">Collection Details for LAB-101</h2>
                            <span className="bg-teal-200 text-teal-800 text-[10px] font-black uppercase px-2 py-1 rounded">Pending</span>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Patient Identity Verification</label>
                                    <select className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:border-teal-500 transition-colors">
                                        <option>Confirmed via ID</option>
                                        <option>Confirmed via OTP</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Sample Type</label>
                                    <select className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:border-teal-500 transition-colors">
                                        <option>Blood - EDTA</option>
                                        <option>Blood - Serum</option>
                                        <option>Urine</option>
                                        <option>Saliva</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 flex flex-col items-center justify-center">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Generated Barcode</p>
                                <div className="bg-white px-8 py-4 border-2 border-dashed border-slate-300 rounded-xl font-mono text-2xl tracking-widest text-slate-800 font-bold mb-4">
                                    || ||| | ||| || | ||
                                </div>
                                <button className="text-teal-600 font-bold text-sm bg-teal-50 border border-teal-200 px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors">
                                    Print Label
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t p-6 flex justify-end gap-4">
                            <button className="px-6 py-2 border border-slate-300 font-bold text-slate-600 rounded-xl hover:bg-white">Cancel</button>
                            <button className="px-8 py-2 bg-teal-600 font-bold text-white rounded-xl shadow-sm hover:bg-teal-700 active:scale-95 transition-all">Mark as Collected</button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SampleCollection;
