import React, { useState } from 'react';

const PharmacyOrderDetails = ({ order, onClose }) => {
    // Mock items based on order
    const [items, setItems] = useState([
        { id: 1, name: 'Amoxicillin', strength: '500mg', dosage: '1-0-1', frequency: 'Twice daily', duration: 5, quantity: 10, status: 'Available' },
        { id: 2, name: 'Paracetamol', strength: '650mg', dosage: '1-1-1', frequency: 'Thrice daily', duration: 3, quantity: 9, status: 'Low Stock' },
        { id: 3, name: 'Vitamin C', strength: '500mg', dosage: '1-0-0', frequency: 'Once daily', duration: 10, quantity: 10, status: 'Out of Stock' },
    ]);

    const handleStatusChange = (id, newStatus) => {
        setItems(items.map(item => item.id === id ? { ...item, status: newStatus } : item));
    };

    const hasOutofStock = items.some(i => i.status === 'Out of Stock');

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] flex justify-end backdrop-blur-sm">
            <div className="w-[800px] bg-slate-50 h-full shadow-2xl animate-slide-left flex flex-col overflow-hidden">
                <div className="bg-white px-8 py-6 border-b flex justify-between items-center shadow-sm z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-slate-800">Order {order.id}</h2>
                            {order.source === 'External' ? (
                                <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded">External Prescription</span>
                            ) : (
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Digital Prescription</span>
                            )}
                        </div>
                        <p className="text-slate-500 text-sm">Prescribed by Dr. {order.doctor} on {order.time}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-lg hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {/* Patient Info */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6">
                        <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-600 font-bold text-2xl flex items-center justify-center">
                            {order.patient.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{order.patient}</h3>
                            <p className="text-slate-500 font-medium text-sm">Patient ID: PT-9921 • Male • 45 Yrs</p>
                        </div>
                    </div>

                    {/* Verification Checklist */}
                    {order.status === 'Pending' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">⚠️</span> Verification Required
                            </h4>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 text-blue-900 font-medium">
                                    <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" /> Confirm Patient Identity
                                </label>
                                <label className="flex items-center gap-3 text-blue-900 font-medium">
                                    <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" /> Check Drug Interactions
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Medication Availability Panel */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                            <h3 className="font-bold text-slate-800">Medication Availability Panel</h3>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
                                    <th className="px-6 py-4 font-bold">Medicine</th>
                                    <th className="px-6 py-4 font-bold">Dosage</th>
                                    <th className="px-6 py-4 font-bold">Qty</th>
                                    <th className="px-6 py-4 font-bold">Availability</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800">{item.name}</p>
                                            <p className="text-xs text-slate-500">{item.strength} • {item.duration} days</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-slate-700">{item.dosage}</p>
                                            <p className="text-xs text-slate-500">{item.frequency}</p>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{item.quantity}</td>
                                        <td className="px-6 py-4">
                                            <select 
                                                value={item.status} 
                                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                                className={`text-sm font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${
                                                    item.status === 'Available' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    item.status === 'Low Stock' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}
                                            >
                                                <option value="Available">🟢 Available</option>
                                                <option value="Low Stock">🟡 Low Stock</option>
                                                <option value="Out of Stock">🔴 Out of Stock</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 border-t shadow-lg flex justify-between items-center z-10">
                    <div>
                        {hasOutofStock && (
                            <p className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-md">
                                Warning: Out of stock items detected.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button className="px-6 py-3 border border-slate-300 font-bold text-slate-600 rounded-xl hover:bg-slate-50">Cancel</button>
                        <button className={`px-6 py-3 font-bold text-white rounded-xl shadow-sm transition-transform active:scale-95 ${
                            hasOutofStock ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-600 hover:bg-teal-700'
                        }`}>
                            {hasOutofStock ? 'Partially Dispense' : 'Dispense All'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PharmacyOrderDetails;
