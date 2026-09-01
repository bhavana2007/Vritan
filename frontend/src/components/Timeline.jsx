import React from "react";

function Timeline({ events }) {
  const getEventIcon = (type) => {
    const icons = {
      prescription_created: "📋",
      medical_report_uploaded: "📁",
      lab_result_added: "🔬",
      access_granted: "✅",
      access_expired: "⏰",
      otp_generated: "🔐",
      prescription_signed: "✍️",
      diagnosis_added: "🩺",
    };
    return icons[type] || "📌";
  };

  const getEventColor = (type) => {
    const colors = {
      prescription_created: "bg-blue-100 text-blue-700",
      medical_report_uploaded: "bg-purple-100 text-purple-700",
      lab_result_added: "bg-green-100 text-green-700",
      access_granted: "bg-teal-100 text-teal-700",
      access_expired: "bg-red-100 text-red-700",
      otp_generated: "bg-yellow-100 text-yellow-700",
      prescription_signed: "bg-indigo-100 text-indigo-700",
      diagnosis_added: "bg-pink-100 text-pink-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No timeline events available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`p-2 rounded-full ${getEventColor(event.type)}`}>
              <span className="text-lg">{getEventIcon(event.type)}</span>
            </div>
            {index < events.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-gray-900">{event.title}</p>
              <p className="text-xs text-gray-500">{formatDateTime(event.timestamp)}</p>
            </div>
            {event.description && (
              <p className="text-sm text-gray-600">{event.description}</p>
            )}
            {event.metadata && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                {Object.entries(event.metadata).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500">{key}:</span>{" "}
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Timeline;
