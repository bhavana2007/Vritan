import React, { useState } from 'react';
import AppointmentWizard from '../components/appointments/AppointmentWizard';
import MyAppointments from '../components/appointments/MyAppointments';

const PatientAppointments = () => {
    const [activeTab, setActiveTab] = useState('book'); // 'book' or 'manage'

    return (
        <div className="flex flex-col h-full animate-fade-in">
                <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
                        <p className="text-gray-500 text-sm mt-1">Manage your health schedule and book consultations.</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex space-x-1 mb-6 bg-white p-1 rounded-xl shadow-sm inline-flex">
                            <button
                                onClick={() => setActiveTab('book')}
                                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                                    activeTab === 'book' 
                                        ? 'bg-blue-600 text-white shadow' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                Book Appointment
                            </button>
                            <button
                                onClick={() => setActiveTab('manage')}
                                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                                    activeTab === 'manage' 
                                        ? 'bg-blue-600 text-white shadow' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                My Appointments
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[600px]">
                            {activeTab === 'book' ? (
                                <AppointmentWizard />
                            ) : (
                                <MyAppointments />
                            )}
                        </div>
                    </div>
                </main>
        </div>
    );
};

export default PatientAppointments;
