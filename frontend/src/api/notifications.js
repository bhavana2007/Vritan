import { apiClient } from "./client";

export const notificationsApi = {
  getNotifications: () => apiClient.get("/patient/notifications"),
  markAsRead: (id) => apiClient.put(`/patient/notifications/${id}/read`),
  markAllAsRead: () => apiClient.put("/patient/notifications/read-all"),
  getUnreadCount: () => apiClient.get("/patient/notifications/unread-count")
};
