import React from "react";

function NotificationItem({ notification, onRead, onDismiss }) {
  const getNotificationIcon = (type) => {
    const icons = {
      access_approved: "✅",
      access_expired: "⏰",
      prescription_created: "📋",
      medical_report_uploaded: "📁",
      lab_result_added: "🔬",
      system: "🔔",
    };
    return icons[type] || "🔔";
  };

  const getNotificationColor = (type) => {
    const colors = {
      access_approved: "bg-green-50 border-green-200",
      access_expired: "bg-red-50 border-red-200",
      prescription_created: "bg-blue-50 border-blue-200",
      medical_report_uploaded: "bg-purple-50 border-purple-200",
      lab_result_added: "bg-teal-50 border-teal-200",
      system: "bg-gray-50 border-gray-200",
    };
    return colors[type] || colors.system;
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`p-4 rounded-lg border ${getNotificationColor(notification.type)} ${
      !notification.read ? "border-l-4 border-l-teal-600" : ""
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{getNotificationIcon(notification.type)}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-gray-900">{notification.title}</p>
            <p className="text-xs text-gray-500">{formatDateTime(notification.timestamp)}</p>
          </div>
          <p className="text-sm text-gray-600">{notification.message}</p>
          {notification.actionUrl && (
            <button
              onClick={() => window.location.href = notification.actionUrl}
              className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              View Details →
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default NotificationItem;
