import { useState, useEffect } from "react";
import api from "../services/api";

function SharedSettings({ userRole, userProfile, onUpdate }) {
  const [activeTab, setActiveTab] = useState("account");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const [workingDays, setWorkingDays] = useState({
    0: true, // Monday
    1: true,
    2: true,
    3: true,
    4: true,
    5: false, // Saturday
    6: false, // Sunday
  });
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotDuration, setSlotDuration] = useState(30);
  const [consultationFee, setConsultationFee] = useState(500);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [maxApps, setMaxApps] = useState(20);
  const [bookingWindow, setBookingWindow] = useState(30);
  const [cancelHours, setCancelHours] = useState(24);

  const [exceptions, setExceptions] = useState([]);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState("Leave");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("EVERY_SATURDAY");

  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  useEffect(() => {
    if (userRole !== "doctor" || activeTab !== "schedule") return;

    const fetchScheduleData = async () => {
      setIsLoadingSchedule(true);
      try {
        const availRes = await fetch("http://localhost:8000/doctor/availability", {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
        });
        const availData = await availRes.json();
        
        if (availData && availData.length > 0) {
          const days = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
          availData.forEach(a => {
            days[a.day_of_week] = true;
          });
          setWorkingDays(days);
          setStartTime(availData[0].start_time);
          setEndTime(availData[0].end_time);
          setSlotDuration(availData[0].slot_duration_minutes);
        }

        const settingsRes = await fetch("http://localhost:8000/doctor/profile-settings", {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
        });
        const settingsData = await settingsRes.json();
        if (settingsData) {
          setConsultationFee(settingsData.consultation_fee);
          setBufferMinutes(settingsData.buffer_minutes);
          setMaxApps(settingsData.max_appointments_per_day);
          setBookingWindow(settingsData.advance_booking_window_days);
          setCancelHours(settingsData.cancellation_notice_hours);
        }

        const excRes = await fetch("http://localhost:8000/doctor/availability/exceptions", {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
        });
        const excData = await excRes.json();
        if (excData) {
          setExceptions(excData);
        }
      } catch (err) {
        console.error("Error loading schedule settings:", err);
      } finally {
        setIsLoadingSchedule(false);
      }
    };

    fetchScheduleData();
  }, [activeTab, userRole]);

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMessage("");
      
      const availabilities = Object.keys(workingDays)
        .filter(day => workingDays[day])
        .map(day => ({
          day_of_week: parseInt(day),
          start_time: startTime,
          end_time: endTime,
          slot_duration_minutes: parseInt(slotDuration)
        }));

      await fetch("http://localhost:8000/doctor/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({ availabilities })
      });

      await fetch("http://localhost:8000/doctor/profile-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({
          consultation_fee: parseFloat(consultationFee),
          buffer_minutes: parseInt(bufferMinutes),
          max_appointments_per_day: parseInt(maxApps),
          advance_booking_window_days: parseInt(bookingWindow),
          cancellation_notice_hours: parseInt(cancelHours)
        })
      });

      setSuccessMessage("Availability and schedule settings saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to save schedule settings.");
    }
  };

  const handleAddException = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMessage("");

      await fetch("http://localhost:8000/doctor/availability/exceptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify({
          exception_date: isRecurring ? null : exceptionDate,
          exception_type: exceptionType,
          is_recurring: isRecurring,
          recurrence_pattern: isRecurring ? recurrencePattern : null
        })
      });

      // Reload exceptions
      const excRes = await fetch("http://localhost:8000/doctor/availability/exceptions", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token") || ""}` }
      });
      const excData = await excRes.json();
      if (excData) {
        setExceptions(excData);
      }
      
      setSuccessMessage("Leave / Exception added successfully.");
      setExceptionDate("");
    } catch (err) {
      console.error(err);
      setError("Failed to add leave/exception.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const currentPassword = e.target.currentPassword.value;
    const newPassword = e.target.newPassword.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      // Using existing auth logic for password change - just a mock for now
      // await api.post(`/${userRole}/change-password`, { currentPassword, newPassword });
      setSuccessMessage("Password changed successfully.");
      e.target.reset();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change password.");
    }
  };

  const handleNotificationChange = (e) => {
    e.preventDefault();
    setSuccessMessage("Notification preferences saved successfully.");
  };

  const handlePrivacyChange = (e) => {
    e.preventDefault();
    setSuccessMessage("Privacy settings saved successfully.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab("account"); setError(""); setSuccessMessage(""); }}
          className={`px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === "account"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Account Settings
        </button>
        <button
          onClick={() => { setActiveTab("notifications"); setError(""); setSuccessMessage(""); }}
          className={`px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === "notifications"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => { setActiveTab("privacy"); setError(""); setSuccessMessage(""); }}
          className={`px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === "privacy"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          Privacy & Security
        </button>
        {userRole === "doctor" && (
          <button
            onClick={() => { setActiveTab("schedule"); setError(""); setSuccessMessage(""); }}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === "schedule"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Availability & Schedule
          </button>
        )}
      </div>

      <div className="p-8">
        {successMessage && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {activeTab === "account" && (
          <div className="max-w-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Update Password
              </button>
            </form>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Notification Preferences</h3>
            <form onSubmit={handleNotificationChange} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="font-medium text-slate-900">In-App Notifications</h4>
                    <p className="text-sm text-slate-500">Receive notifications within the portal</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="font-medium text-slate-900">Email Notifications</h4>
                    <p className="text-sm text-slate-500">Receive important updates via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 opacity-60">
                  <div>
                    <h4 className="font-medium text-slate-900">SMS Notifications (Coming Soon)</h4>
                    <p className="text-sm text-slate-500">Receive text alerts for urgent updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-not-allowed">
                    <input type="checkbox" disabled className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Save Preferences
              </button>
            </form>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Privacy & Data Control</h3>
            <form onSubmit={handlePrivacyChange} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="font-medium text-slate-900">Profile Visibility</h4>
                    <p className="text-sm text-slate-500">Allow others to find your profile</p>
                  </div>
                  <select className="px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500">
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="font-medium text-slate-900">Data Analytics</h4>
                    <p className="text-sm text-slate-500">Allow anonymous usage data collection</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-8">
                <h4 className="font-medium text-red-600 mb-2">Danger Zone</h4>
                <p className="text-sm text-slate-500 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                <button
                  type="button"
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  Delete Account
                </button>
              </div>

              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium mt-6 block"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-6">Weekly Availability & Configuration</h3>
              <form onSubmit={handleSaveSchedule} className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm">Select Working Days</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { id: 0, name: "Monday" },
                      { id: 1, name: "Tuesday" },
                      { id: 2, name: "Wednesday" },
                      { id: 3, name: "Thursday" },
                      { id: 4, name: "Friday" },
                      { id: 5, name: "Saturday" },
                      { id: 6, name: "Sunday" }
                    ].map(day => (
                      <label key={day.id} className="flex items-center space-x-2 text-sm font-semibold text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={workingDays[day.id] || false}
                          onChange={(e) => setWorkingDays({ ...workingDays, [day.id]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <span>{day.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Slot Duration (Minutes)</label>
                    <select
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Consultation Fee (₹)</label>
                    <input
                      type="number"
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Buffer Time Between Slots (Minutes)</label>
                    <input
                      type="number"
                      value={bufferMinutes}
                      onChange={(e) => setBufferMinutes(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Max Appointments / Day</label>
                    <input
                      type="number"
                      value={maxApps}
                      onChange={(e) => setMaxApps(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Advance Booking Window (Days)</label>
                    <input
                      type="number"
                      value={bookingWindow}
                      onChange={(e) => setBookingWindow(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Cancellation Notice (Hours)</label>
                    <input
                      type="number"
                      value={cancelHours}
                      onChange={(e) => setCancelHours(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm"
                >
                  Save Availability & Settings
                </button>
              </form>
            </div>

            <div className="pt-8 border-t border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Leaves, Holidays & Blocked Dates</h3>
              
              <form onSubmit={handleAddException} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 mb-6">
                <h4 className="font-bold text-slate-800 text-sm">Add Leave / Blocked Period</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded"
                      />
                      <span>Is Recurring Rule</span>
                    </label>
                  </div>

                  {isRecurring ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Recurrence Pattern</label>
                      <select
                        value={recurrencePattern}
                        onChange={(e) => setRecurrencePattern(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                      >
                        <option value="EVERY_SATURDAY">Every Saturday OFF</option>
                        <option value="EVERY_SUNDAY">Every Sunday OFF</option>
                        <option value="EVERY_SECOND_FRIDAY">Every Second Friday OFF</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Select Leave Date</label>
                      <input
                        type="date"
                        value={exceptionDate}
                        onChange={(e) => setExceptionDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Reason / Exception Type</label>
                    <select
                      value={exceptionType}
                      onChange={(e) => setExceptionType(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-xl outline-none text-xs"
                    >
                      <option value="Leave">Vacation / Leave</option>
                      <option value="Holiday">Public Holiday</option>
                      <option value="Conference">Medical Conference</option>
                      <option value="Emergency Block">Emergency Block</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Add Leave Exception
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">Active Exceptions & Blocked Days</h4>
                {exceptions.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">No active leave exceptions configured.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden">
                    {exceptions.map((exc) => (
                      <div key={exc.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            {exc.is_recurring ? `Recurring: ${exc.recurrence_pattern.replace("_", " ")}` : exc.exception_date}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">Type: {exc.exception_type}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Blocked
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedSettings;
