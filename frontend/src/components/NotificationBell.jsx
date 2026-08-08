import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, parseFastApiDetail } from "../api";
import { useAuth } from "../hooks/useAuth";

function NotificationBell({ roleBasePath }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latest, setLatest] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { token } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE}/notifications/unread`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          setUnreadCount(0);
          setLatest([]);
          return;
        }
        const data = await response.json().catch(() => ({}));
        if (data && data.data) {
          setUnreadCount(data.data.count || 0);
          setLatest(data.data.latest || []);
        } else {
          setUnreadCount(0);
          setLatest([]);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        setUnreadCount(0);
        setLatest([]);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = (notif) => {
    setIsOpen(false);
    if (notif.action_url) {
      navigate(notif.action_url);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-indigo-600 transition-colors focus:outline-none"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-[100] animate-fade-in text-left">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} New</span>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {(() => {
              const latestList = Array.isArray(latest) ? latest : [];
              return latestList.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {latestList.map(notif => {
                    if (!notif) return null;
                    const isCritical = notif.priority === 'Critical';
                    const dateStr = notif.created_at ? new Date(notif.created_at).toLocaleString() : "Just now";
                    return (
                      <div
                        key={notif.id || Math.random()}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${isCritical ? 'bg-red-50/50 hover:bg-red-50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`font-bold text-sm ${isCritical ? 'text-red-700' : 'text-slate-800'}`}>{notif.title || "Notification"}</h4>
                          {isCritical && <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">URGENT</span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{notif.message || ""}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">{dateStr}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No new notifications.
                </div>
              );
            })()}
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-2">
            <button
              onClick={() => { setIsOpen(false); navigate('/notifications'); }}
              className="w-full py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
