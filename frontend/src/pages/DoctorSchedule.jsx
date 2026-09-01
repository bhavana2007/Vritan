import React, { useState, useEffect } from 'react';
import DoctorSidebar from '../components/DoctorSidebar';
import { apiClient } from '../api/client';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DoctorSchedule = ({ doctorId = null, isReadOnly = false }) => {
    const [activeTab, setActiveTab] = useState('weekly'); // weekly or exceptions
    
    // Weekly Schedule State
    const [slotDuration, setSlotDuration] = useState(30);
    const [weeklySchedule, setWeeklySchedule] = useState({
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    });
    
    // Exceptions State
    const [exceptions, setExceptions] = useState([]);
    
    // Daily Slots State
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [dailySlots, setDailySlots] = useState([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSchedule();
        fetchExceptions();
    }, []);

    const fetchSchedule = async () => {
        try {
            const data = await apiClient.get(`/api/v1/doctor-schedule/availability${doctorId ? `?doctor_id=${doctorId}` : ''}`);
            setSlotDuration(data.slot_duration_minutes || 30);
            
            const newSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
            (data.availability || []).forEach(item => {
                newSchedule[item.day_of_week].push({ start: item.start_time, end: item.end_time });
            });
            setWeeklySchedule(newSchedule);
        } catch (error) {
            console.error("Failed to load schedule", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSlots = async (dateStr) => {
        setIsLoadingSlots(true);
        try {
            const data = await apiClient.get(`/api/v1/appointments/slots?doctor_id=${doctorId}&date=${dateStr}`);
            setDailySlots(data || []);
        } catch (error) {
            console.error("Failed to load slots", error);
            setDailySlots([]);
        } finally {
            setIsLoadingSlots(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'daily' && doctorId) {
            fetchSlots(selectedDate);
        }
    }, [activeTab, selectedDate, doctorId]);

    const fetchExceptions = async () => {
        try {
            const data = await apiClient.get(`/api/v1/doctor-schedule/exceptions${doctorId ? `?doctor_id=${doctorId}` : ''}`);
            setExceptions(data || []);
        } catch (error) {
            console.error("Failed to load exceptions", error);
        }
    };

    const handleSaveWeekly = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            const payload = {
                slot_duration_minutes: parseInt(slotDuration),
                availability: []
            };
            
            Object.keys(weeklySchedule).forEach(dayIdx => {
                weeklySchedule[dayIdx].forEach(period => {
                    if (period.start && period.end) {
                        payload.availability.push({
                            day_of_week: parseInt(dayIdx),
                            start_time: period.start,
                            end_time: period.end
                        });
                    }
                });
            });
            
            await apiClient.put('/api/v1/doctor-schedule/availability', payload);
            setMessage({ type: 'success', text: 'Weekly schedule saved successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save schedule.' });
        } finally {
            setIsSaving(false);
        }
    };

    const addPeriod = (dayIdx) => {
        setWeeklySchedule({
            ...weeklySchedule,
            [dayIdx]: [...weeklySchedule[dayIdx], { start: "09:00", end: "17:00" }]
        });
    };

    const updatePeriod = (dayIdx, periodIdx, field, value) => {
        const newDay = [...weeklySchedule[dayIdx]];
        newDay[periodIdx][field] = value;
        setWeeklySchedule({ ...weeklySchedule, [dayIdx]: newDay });
    };

    const removePeriod = (dayIdx, periodIdx) => {
        const newDay = [...weeklySchedule[dayIdx]];
        newDay.splice(periodIdx, 1);
        setWeeklySchedule({ ...weeklySchedule, [dayIdx]: newDay });
    };

    // --- Exceptions UI Handlers ---
    const [excForm, setExcForm] = useState({ date: '', type: 'Leave', start: '', end: '' });
    
    const handleAddException = async () => {
        if (!excForm.date) {
            alert("Please select a date.");
            return;
        }
        setIsSaving(true);
        try {
            await apiClient.post('/api/v1/doctor-schedule/exceptions', {
                exception_date: excForm.date,
                exception_type: excForm.type,
                start_time: excForm.type === 'Partial' ? excForm.start : null,
                end_time: excForm.type === 'Partial' ? excForm.end : null
            });
            setExcForm({ date: '', type: 'Leave', start: '', end: '' });
            fetchExceptions();
            setMessage({ type: 'success', text: 'Date override added!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            alert(error.message || "Failed to add override.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteException = async (id) => {
        if (!window.confirm("Are you sure you want to remove this override?")) return;
        try {
            await apiClient.delete(`/api/v1/doctor-schedule/exceptions/${id}`);
            fetchExceptions();
        } catch (error) {
            alert("Failed to delete.");
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans">
            {!isReadOnly && <DoctorSidebar currentPage="schedule" />}
            
            <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
                <header className="bg-white border-b px-8 py-5 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-800">{isReadOnly ? "Doctor Availability" : "My Availability"}</h1>{isReadOnly && <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">View Only</span>}</div>
                        <p className="text-slate-500 text-sm mt-1">{isReadOnly ? "Viewing doctor schedule." : "Configure your weekly schedule and date-specific leaves."}</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 max-w-6xl">
                    
                    {message && (
                        <div className={`mb-6 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex space-x-1 mb-6 bg-white p-1 rounded-xl shadow-sm inline-flex">
                        <button
                            onClick={() => setActiveTab('weekly')}
                            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                                activeTab === 'weekly' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Weekly Schedule
                        </button>
                        <button
                            onClick={() => setActiveTab('exceptions')}
                            className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                                activeTab === 'exceptions' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Date Overrides (Leave/Holiday)
                        </button>
                        {isReadOnly && (
                            <button
                                onClick={() => setActiveTab('daily')}
                                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                                    activeTab === 'daily' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Appointment Schedule
                            </button>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500 font-medium">Loading schedule...</div>
                    ) : activeTab === 'weekly' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                            <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Standard Weekly Schedule</h2>
                                    <p className="text-sm text-slate-500">Define your regular working hours.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-slate-700">Slot Duration:</label>
                                    <select disabled={isReadOnly}
                                        value={slotDuration} 
                                        onChange={(e) => setSlotDuration(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    >
                                        <option value={15}>15 mins</option>
                                        <option value={20}>20 mins</option>
                                        <option value={30}>30 mins</option>
                                        <option value={45}>45 mins</option>
                                        <option value={60}>60 mins</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {DAYS_OF_WEEK.map((day, idx) => {
                                    const periods = weeklySchedule[idx] || [];
                                    const isAvailable = periods.length > 0;

                                    return (
                                        <div key={day} className={`flex items-start gap-4 p-4 rounded-xl border ${isAvailable ? 'bg-blue-50/30 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="w-32 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    <span className={`font-bold ${isAvailable ? 'text-slate-800' : 'text-slate-400'}`}>{day}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 space-y-3">
                                                {periods.map((period, pIdx) => (
                                                    <div key={pIdx} className="flex items-center gap-3">
                                                        <input 
                                                            type="time" disabled={isReadOnly}
                                                            value={period.start}
                                                            onChange={(e) => updatePeriod(idx, pIdx, 'start', e.target.value)}
                                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
                                                        />
                                                        <span className="text-slate-400">to</span>
                                                        <input 
                                                            type="time" disabled={isReadOnly}
                                                            value={period.end}
                                                            onChange={(e) => updatePeriod(idx, pIdx, 'end', e.target.value)}
                                                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium"
                                                        />
                                                        {!isReadOnly && <button 
                                                            onClick={() => removePeriod(idx, pIdx)}
                                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Remove Period"
                                                        >
                                                            ✕
                                                        </button>}
                                                    </div>
                                                ))}
                                                {periods.length === 0 && (
                                                    <div className="text-sm text-slate-400 italic py-2">Unavailable</div>
                                                )}
                                                {!isReadOnly && <div>
                                                    <button 
                                                        onClick={() => addPeriod(idx)}
                                                        className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                    >
                                                        + Add Period
                                                    </button>
                                                </div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {!isReadOnly && <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                <button 
                                    onClick={handleSaveWeekly}
                                    disabled={isSaving}
                                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Weekly Schedule'}
                                </button>
                            </div>}
                        </div>
                    ) : activeTab === 'daily' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fade-in">
                            <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Daily Appointment Schedule</h2>
                                    <p className="text-sm text-slate-500">View appointment slots for a specific date.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-bold text-slate-700">Select Date:</label>
                                    <input 
                                        type="date" 
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {isLoadingSlots ? (
                                <div className="text-center py-12 text-slate-500 font-medium">Loading slots...</div>
                            ) : dailySlots.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 font-medium">No slots generated for this date. (Doctor may be unavailable or on leave)</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dailySlots.map((slot, idx) => {
                                        let statusColor = "bg-green-50 border-green-200 text-green-700";
                                        let statusText = "Available";
                                        
                                        if (!slot.available) {
                                            statusColor = "bg-rose-50 border-rose-200 text-rose-700";
                                            statusText = "Booked";
                                        }

                                        return (
                                            <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border ${statusColor}`}>
                                                <div className="font-bold">{slot.time}</div>
                                                <div className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white/50 rounded-md">
                                                    {statusText}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                {!isReadOnly && <><h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Add Date Override</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                                        <input 
                                            type="date" 
                                            value={excForm.date}
                                            onChange={(e) => setExcForm({...excForm, date: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                                        <select 
                                            value={excForm.type}
                                            onChange={(e) => setExcForm({...excForm, type: e.target.value})}
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 font-medium"
                                        >
                                            <option value="Leave">Full Day Leave</option>
                                            <option value="Partial">Partial Availability</option>
                                        </select>
                                    </div>
                                    {excForm.type === 'Partial' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Available From</label>
                                                <input 
                                                    type="time" 
                                                    value={excForm.start}
                                                    onChange={(e) => setExcForm({...excForm, start: e.target.value})}
                                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Available Until</label>
                                                <input 
                                                    type="time" 
                                                    value={excForm.end}
                                                    onChange={(e) => setExcForm({...excForm, end: e.target.value})}
                                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 font-medium"
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="md:col-span-4 flex justify-end mt-2">
                                        <button 
                                            onClick={handleAddException}
                                            disabled={isSaving}
                                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                                        >
                                            Add Override
                                        </button>
                                    </div>
                                </div></>}
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="text-lg font-bold text-slate-800">Current Overrides</h2>
                                </div>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Availability</th>
                                            {!isReadOnly && <th className="px-6 py-4 text-right">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {exceptions.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-8 text-center text-slate-500 italic">No date overrides configured.</td>
                                            </tr>
                                        ) : exceptions.map(exc => (
                                            <tr key={exc.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">{new Date(exc.exception_date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${exc.exception_type === 'Leave' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {exc.exception_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                    {exc.exception_type === 'Leave' ? 'Unavailable' : `${exc.start_time} - ${exc.end_time}`}
                                                </td>
                                                {!isReadOnly && <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleDeleteException(exc.id)}
                                                        className="text-red-500 font-medium text-sm hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DoctorSchedule;
