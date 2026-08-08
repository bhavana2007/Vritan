import { useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import LoadingSkeleton from "./LoadingSkeleton";

function SharedNotifications() {
  const { notifications, loading, error, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();

  // Refresh when the page opens (on mount)
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
    // Refresh after action
    fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    // Refresh after action
    fetchNotifications(true);
  };

  const getIconForType = (type) => {
    switch (type) {
      case "alert": return "🚨";
      case "success": return "✅";
      case "warning": return "⚠️";
      case "appointment": return "📅";
      case "prescription": return "💊";
      case "record": return "📄";
      default: return "ℹ️";
    }
  };

  const notificationsList = Array.isArray(notifications) ? notifications : [];

  if (loading && notificationsList.length === 0) {
    return <div className="p-6"><LoadingSkeleton type="list" count={4} /></div>;
  }

  const unreadCount = notificationsList.filter((n) => n && !n.is_read).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Notifications</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">You have {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => fetchNotifications(true)}
            className="text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-50 text-red-700">
          <p>{error}</p>
          <button onClick={() => fetchNotifications(true)} className="mt-2 text-sm font-bold underline">Retry</button>
        </div>
      ) : null}

      <div className="divide-y divide-slate-100">
        {notificationsList.length === 0 && !error ? (
          <div className="p-16 text-center text-slate-500">
            <span className="text-5xl mb-4 block">📭</span>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No notifications yet.</h3>
            <p>You'll receive updates here for appointments and records.</p>
          </div>
        ) : (
          notificationsList.map((notification) => {
            if (!notification) return null;
            const notifDate = notification.created_at ? new Date(notification.created_at) : null;
            const dateStr = notifDate && !Number.isNaN(notifDate.getTime())
              ? notifDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
              : "Just now";
            return (
              <div
                key={notification.id || Math.random()}
                className={`p-6 transition-colors flex gap-4 ${notification.is_read ? "bg-white hover:bg-slate-50" : "bg-blue-50/50 hover:bg-blue-50"
                  }`}
              >
                <div className="text-3xl pt-1 drop-shadow-sm">{getIconForType(notification.type)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-base font-bold ${notification.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                      {notification.title || "Notification"}
                    </h3>
                    <span className="text-xs font-semibold text-slate-400 whitespace-nowrap ml-4">
                      {dateStr}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm ${notification.is_read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                    {notification.message || ""}
                  </p>
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SharedNotifications;
