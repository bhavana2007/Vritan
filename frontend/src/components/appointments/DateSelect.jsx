import React, { useState } from 'react';

const getNextDays = (numDays) => {
    const days = [];
    for (let i = 0; i < numDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
};

const DateSelect = ({ data, onNext, onBack }) => {
    const availableDates = getNextDays(14); // Next 14 days
    const [selectedDate, setSelectedDate] = useState(data.date || availableDates[0]);

    const handleProceed = () => {
        if (!selectedDate) return;
        onNext({ date: selectedDate });
    };

    return (
        <div className="max-w-4xl mx-auto py-6 animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-extrabold text-slate-900">Select Date</h2>
                <div className="text-slate-500 font-medium">
                    <span className="text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-sm mr-2">{data.doctor?.full_name || data.doctor?.name}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                {availableDates.map(date => {
                    const dateObj = new Date(date);
                    const isToday = date === availableDates[0];
                    const dayName = isToday ? 'Today' : dateObj.toLocaleDateString(undefined, { weekday: 'short' });
                    const displayDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                    return (
                        <button 
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`flex flex-col items-center justify-center px-4 py-4 rounded-2xl transition-all border ${
                                selectedDate === date 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md transform -translate-y-1' 
                                    : 'bg-white hover:bg-blue-50 text-slate-600 border-slate-200 hover:border-blue-200'
                            }`}
                        >
                            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${selectedDate === date ? 'text-blue-200' : 'text-slate-400'}`}>{dayName}</span>
                            <span className="font-extrabold">{displayDate}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-5 rounded-2xl border border-slate-200 gap-4">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors"
                >
                    &larr; Back
                </button>
                
                <button 
                    onClick={handleProceed}
                    disabled={!selectedDate}
                    className={`w-full sm:w-auto px-8 py-3 rounded-xl font-extrabold transition-all ${
                        selectedDate 
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md transform hover:-translate-y-0.5' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    Select Slot &rarr;
                </button>
            </div>
        </div>
    );
};

export default DateSelect;
