import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { organizationApi } from '../../../api/organizationApi';
import OrgAdminSidebar from '../../../components/OrgAdminSidebar';

const Settings = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState({ name: '', registration_number: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const orgVritanId = user?.organization_vritan_id;

    useEffect(() => {
        const fetchProfile = async () => {
            if (!orgVritanId) return;
            try {
                const res = await organizationApi.getOrganizationProfile(orgVritanId);
                if (res.success !== false) {
                    setProfile({
                        name: res.data?.name || '',
                        registration_number: res.data?.registration_number || ''
                    });
                }
            } catch (error) {
                setMessage({ type: 'error', text: error.message || 'Failed to load organization profile.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, [orgVritanId]);

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        if (!orgVritanId) return;
        setIsSaving(true);
        setMessage(null);
        try {
            await organizationApi.updateOrganizationProfile(orgVritanId, profile);
            setMessage({ type: 'success', text: 'Settings saved successfully.' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to update organization profile.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans">
            <OrgAdminSidebar currentPage="settings" />
            
            <div className="flex-1 flex flex-col overflow-y-auto ml-64 p-6 space-y-6 bg-gray-50 min-h-screen">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Organization Settings</h1>
                </header>

                {message && (
                    <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-medium text-gray-900">General Profile</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage your organization's public information.</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {isLoading ? (
                            <div className="text-center py-4 text-gray-500">Loading settings...</div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                                    <input 
                                        type="text" 
                                        name="name"
                                        value={profile.name} 
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                                    <input 
                                        type="text" 
                                        name="registration_number"
                                        value={profile.registration_number} 
                                        onChange={handleChange}
                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 text-right">
                        <button 
                            onClick={handleSave} 
                            disabled={isLoading || isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
