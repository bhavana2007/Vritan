import React, { useState } from 'react';
import PharmacySidebar from '../components/PharmacySidebar';

const ManualPrescriptionEntry = () => {
    const [medicines, setMedicines] = useState([
        { id: 1, name: '', dosage: '', frequency: '', duration: '', qty: '' }
    ]);

    const addMedicine = () => {
        setMedicines([...medicines, { id: Date.now(), name: '', dosage: '', frequency: '', duration: '', qty: '' }]);
    };

    const removeMedicine = (id) => {
        setMedicines(medicines.filter(m => m.id !== id));
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <PharmacySidebar currentPage="manual" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Manual Prescription Entry</h1>
                        <p className="text-slate-500 text-sm mt-1">Digitize external paper prescriptions into the Pharmacy Queue.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-160px)]">
                        <div className="bg-orange-50 border-b border-orange-100 px-6 py-4 flex justify-between items-center">
                            <h2 className="font-bold text-orange-800">External Prescription Details</h2>
                            <span className="bg-orange-200 text-orange-800 text-[10px] font-black uppercase px-2 py-1 rounded">External Source</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Patient Name</label>
                                    <input type="text" className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:border-teal-500 focus:bg-white transition-colors" placeholder="e.g. John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Prescribing Doctor</label>
                                    <input type="text" className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:border-teal-500 focus:bg-white transition-colors" placeholder="e.g. Dr. Sarah Connor" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Hospital / Clinic Name</label>
                                    <input type="text" className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:border-teal-500 focus:bg-white transition-colors" placeholder="e.g. Apollo Hospitals" />
                                </div>
                            </div>

                            <div className="mb-4 flex justify-between items-center border-b pb-2">
                                <h3 className="font-bold text-slate-800">Medicines</h3>
                                <button onClick={addMedicine} className="text-teal-600 font-bold text-sm bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100">+ Add Item</button>
                            </div>

                            <div className="space-y-4">
                                {medicines.map((med, index) => (
                                    <div key={med.id} className="flex gap-4 items-start relative group">
                                        <div className="bg-slate-100 text-slate-500 font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 grid grid-cols-12 gap-4">
                                            <div className="col-span-4">
                                                <input type="text" placeholder="Medicine Name (e.g. Paracetamol)" className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-teal-500" />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="text" placeholder="Dosage (1-0-1)" className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-teal-500 text-center" />
                                            </div>
                                            <div className="col-span-3">
                                                <input type="text" placeholder="Frequency" className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-teal-500" />
                                            </div>
                                            <div className="col-span-2">
                                                <input type="number" placeholder="Days" className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-teal-500 text-center" />
                                            </div>
                                            <div className="col-span-1">
                                                <input type="number" placeholder="Qty" className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:border-teal-500 text-center font-bold" />
                                            </div>
                                        </div>
                                        {medicines.length > 1 && (
                                            <button onClick={() => removeMedicine(med.id)} className="text-red-400 hover:text-red-600 font-bold text-xl px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 border-t p-6 flex justify-end gap-4">
                            <button className="px-6 py-2 border border-slate-300 font-bold text-slate-600 rounded-xl hover:bg-white">Clear Form</button>
                            <button className="px-8 py-2 bg-teal-600 font-bold text-white rounded-xl shadow-sm hover:bg-teal-700 active:scale-95 transition-all">Submit Order to Queue</button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ManualPrescriptionEntry;
