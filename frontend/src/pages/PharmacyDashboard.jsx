import React, { useState } from 'react';
import PharmacySidebar from '../components/PharmacySidebar';
import PharmacyOrderDetails from '../components/PharmacyOrderDetails';

const KanbanCard = ({ order, onClick }) => (
    <div 
        onClick={() => onClick(order)}
        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-teal-400 hover:shadow-md transition-all mb-3 relative overflow-hidden"
    >
        {order.source === 'External' && (
            <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                EXTERNAL
            </div>
        )}
        <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs font-bold text-slate-500">{order.id}</span>
            <span className="text-xs text-slate-400">{order.time}</span>
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">{order.patient}</h4>
        <p className="text-xs text-slate-500 mb-3">Dr. {order.doctor}</p>
        
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">{order.items} Items</span>
            {order.status === 'Pending' && <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">Action Req</span>}
        </div>
    </div>
);

const PharmacyDashboard = () => {
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Mock Kanban Data
    const columns = ['Pending', 'Verified', 'Preparing', 'Ready', 'Dispensed'];
    const mockOrders = [
        { id: 'RX-1001', patient: 'John Doe', doctor: 'Sarah Connor', time: '10:30 AM', status: 'Pending', items: 3, source: 'Digital' },
        { id: 'RX-1002', patient: 'Jane Smith', doctor: 'External', time: '10:45 AM', status: 'Pending', items: 1, source: 'External' },
        { id: 'RX-1003', patient: 'Robert Brown', doctor: 'John Smith', time: '09:15 AM', status: 'Preparing', items: 4, source: 'Digital' },
        { id: 'RX-1004', patient: 'Alice Johnson', doctor: 'Sarah Connor', time: '08:00 AM', status: 'Ready', items: 2, source: 'Digital' },
    ];

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <PharmacySidebar currentPage="dashboard" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Pharmacy Queue</h1>
                        <p className="text-slate-500 text-sm mt-1">Manage and fulfill prescriptions.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-x-auto p-8">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Pending Orders</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">2</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Preparing</p>
                            <p className="text-3xl font-bold text-orange-500 mt-1">1</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Ready for Pickup</p>
                            <p className="text-3xl font-bold text-teal-600 mt-1">1</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Dispensed Today</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">14</p>
                        </div>
                    </div>

                    {/* Kanban Board */}
                    <div className="flex gap-6 h-[calc(100vh-280px)] min-w-max pb-4">
                        {columns.map(col => (
                            <div key={col} className="w-80 flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h3 className="font-bold text-slate-700">{col}</h3>
                                    <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                                        {mockOrders.filter(o => o.status === col).length}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2">
                                    {mockOrders.filter(o => o.status === col).map(order => (
                                        <KanbanCard key={order.id} order={order} onClick={setSelectedOrder} />
                                    ))}
                                    {mockOrders.filter(o => o.status === col).length === 0 && (
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl h-24 flex items-center justify-center text-slate-400 text-sm font-medium">
                                            No orders
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
            
            {/* Slide-over for Order Details */}
            {selectedOrder && (
                <PharmacyOrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />
            )}
        </div>
    );
};

export default PharmacyDashboard;
