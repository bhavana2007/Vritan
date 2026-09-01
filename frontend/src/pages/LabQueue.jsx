import React, { useState } from 'react';
import LabSidebar from '../components/LabSidebar';

const LabKanbanCard = ({ order, onClick }) => (
    <div 
        onClick={() => onClick && onClick(order)}
        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-teal-400 hover:shadow-md transition-all mb-3 relative"
    >
        {order.priority === 'STAT' && (
            <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg animate-pulse">
                STAT
            </div>
        )}
        <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs font-bold text-slate-500">{order.id}</span>
            <span className="text-xs font-medium text-slate-400">{order.time}</span>
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1">{order.patient}</h4>
        <p className="text-xs text-slate-500 mb-3">Ref: Dr. {order.doctor}</p>
        
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">{order.tests.length} Tests</span>
            {order.status === 'Ordered' && <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded">Collect</span>}
        </div>
    </div>
);

const LabQueue = () => {
    // Mock Data
    const columns = ['Ordered', 'Collection Pending', 'Processing', 'Verification Pending', 'Completed'];
    const mockOrders = [
        { id: 'LAB-101', patient: 'John Doe', doctor: 'Sarah Connor', time: '09:00 AM', status: 'Ordered', priority: 'Routine', tests: ['Lipid Profile', 'CBC'] },
        { id: 'LAB-102', patient: 'Jane Smith', doctor: 'John Smith', time: '09:30 AM', status: 'Processing', priority: 'STAT', tests: ['Troponin'] },
        { id: 'LAB-103', patient: 'Robert Brown', doctor: 'Sarah Connor', time: '10:00 AM', status: 'Verification Pending', priority: 'Routine', tests: ['HbA1c'] },
        { id: 'LAB-104', patient: 'Alice Johnson', doctor: 'John Smith', time: '08:00 AM', status: 'Completed', priority: 'Routine', tests: ['Vitamin D'] },
    ];

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <LabSidebar currentPage="queue" />
            
            <div className="flex-1 flex flex-col overflow-hidden ml-64">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Processing Queue</h1>
                        <p className="text-slate-500 text-sm mt-1">Track diagnostic lifecycle from order to delivery.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-x-auto p-8">
                    {/* Kanban Board */}
                    <div className="flex gap-6 h-[calc(100vh-160px)] min-w-max pb-4">
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
                                        <LabKanbanCard key={order.id} order={order} />
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
        </div>
    );
};

export default LabQueue;
