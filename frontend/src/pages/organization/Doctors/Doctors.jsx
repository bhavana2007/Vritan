import React from 'react';

const Doctors = () => {
    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Organization Doctors</h1>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition">
                    + Invite Doctor
                </button>
            </header>

            <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">No Doctors Assigned</h3>
                <p className="text-gray-500 mt-1">Invite doctors to your organization to start managing schedules and workload.</p>
            </div>
        </div>
    );
};

export default Doctors;
