import React, { useState, useEffect } from 'react';
import { appointmentsApi } from '../../api/appointments';

const getTodayDateString = () => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(today);
};

const getNextDays = (numDays) => {
    const days = [];
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const today = new Date();
    // Getting current time in IST
    const istTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    for (let i = 0; i < numDays; i++) {
        const date = new Date(istTime);
        date.setDate(date.getDate() + i);
        
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
};

const SlotSelect = ({ data, onNext, onBack }) => {
    const selectedDate = data.date;
    const [slotsRaw, setSlotsRaw] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [lockedSlot, setLockedSlot] = useState(null);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

    useEffect(() => {
        const fetchSlots = async () => {
            const doctorId = data.doctor?.user_id || data.doctor?.id;
            if (!doctorId) {
                setError("Doctor not found. Please go back and select a doctor.");
                setIsLoading(false);
                return;
            }
            if (!selectedDate) {
                setError("Date not found. Please go back and select a date.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setLockedSlot(null);
            try {
                const res = await appointmentsApi.getAvailableSlots(doctorId, selectedDate);
                setSlotsRaw(res || []);
            } catch (err) {
                console.error(err);
                setError("Failed to load available slots.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSlots();
    }, [data.doctor, selectedDate]);

    useEffect(() => {
        let timer;
        if (lockedSlot && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0 && lockedSlot) {
            setLockedSlot(null);
            alert("Reservation expired. Please select a slot again.");
        }
        return () => clearInterval(timer);
    }, [lockedSlot, timeLeft]);

    const handleLockSlot = async (slot) => {
        if (!slot.available) return;
        
        try {
            const res = await appointmentsApi.lockSlot({
                doctor_id: data.doctor?.user_id || data.doctor?.id,
                date: selectedDate,
                start_time: slot.time
            });
            // Update slot ID with the one returned by backend
            setLockedSlot({...slot, id: res.slot_id});
            setTimeLeft(300); // Start 5 min timer
        } catch (err) {
            console.error("Lock failed:", err);
            alert(err.message || "Failed to lock slot. It may have just been booked.");
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleProceed = () => {
        if (!lockedSlot || timeLeft === 0) return;
        onNext({ 
            slot: lockedSlot,
            time: lockedSlot.time, 
            date: selectedDate 
        });
    };

    // Group slots
    const slots = { Morning: [], Afternoon: [], Evening: [] };
    slotsRaw.forEach(s => {
        const t = s.time;
        if (t.includes('AM')) {
            slots.Morning.push(s);
        } else if (t.includes('PM')) {
            const hour = parseInt(t.split(':')[0]);
            if (hour === 12 || (hour >= 1 && hour < 5)) {
                slots.Afternoon.push(s);
            } else {
                slots.Evening.push(s);
            }
        }
    });

    return (
        <div className="max-w-4xl mx-auto py-6 animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-extrabold text-slate-900">Select an Appointment Slot</h2>
                <div className="text-slate-500 font-medium">
                    <span className="text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm mr-2">{data.doctor?.full_name || data.doctor?.name}</span>
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-sm mr-2">{data.department?.name}</span>
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-sm">{selectedDate}</span>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 mb-6">
                    {error}
                </div>
            )}

            {/* Slots Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 min-h-[300px]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-500 animate-pulse font-medium">Loading slots for {selectedDate}...</div>
                ) : slotsRaw.length === 0 ? (
                    <div className="text-center p-8">
                        <span className="text-4xl block mb-4">🗓️</span>
                        <p className="text-slate-600 font-medium">No slots available on this date.</p>
                        <p className="text-sm text-slate-500 mt-1">Please select another date.</p>
                    </div>
                ) : (
                    Object.entries(slots).map(([period, timeSlots]) => {
                        if (timeSlots.length === 0) return null;
                        return (
                            <div key={period} className="mb-8 last:mb-0">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    {period === 'Morning' ? '🌅' : period === 'Afternoon' ? '☀️' : '🌙'} {period}
                                </h3>
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {timeSlots.map((slot, idx) => {
                                        const slotId = slot.id || `slot-${idx}`;
                                        const isLocked = lockedSlot?.time === slot.time;
                                        return (
                                            <button
                                                key={slotId}
                                                disabled={!slot.available && !isLocked}
                                                onClick={() => handleLockSlot({...slot, id: slotId})}
                                                className={`py-3 px-2 rounded-xl text-center text-sm font-bold transition-all ${
                                                    isLocked 
                                                        ? 'bg-blue-600 text-white shadow-md transform scale-105 border-blue-600'
                                                        : slot.available
                                                            ? 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer hover:border-blue-400'
                                                            : 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                                }`}
                                            >
                                                {slot.time}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer with Timer and Actions */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-200 gap-4">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors"
                >
                    &larr; Back
                </button>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto">
                    {lockedSlot && (
                        <div className="flex items-center gap-2 text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                            <span className="text-slate-500 font-medium">Slot reserved for:</span>
                            <span className={`font-mono font-extrabold text-lg ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-blue-700'}`}>
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                    )}
                    
                    <button 
                        onClick={handleProceed}
                        disabled={!lockedSlot}
                        className={`w-full sm:w-auto px-8 py-3 rounded-xl font-extrabold transition-all ${
                            lockedSlot 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md transform hover:-translate-y-0.5' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        Review Booking &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SlotSelect;
