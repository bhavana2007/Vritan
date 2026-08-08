import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../hooks/useAuth';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Eagerly fetch unread count on login
  useEffect(() => {
    if (!token) return;
    let mounted = true;
    notificationsApi.getUnreadCount()
      .then(data => {
        if (mounted) setUnreadCount((data && data.count) || 0);
      })
      .catch(err => {
        console.error("Failed to eagerly fetch unread count:", err);
        if (mounted) setUnreadCount(0);
      });
    return () => { mounted = false; };
  }, [token]);

  const fetchNotifications = useCallback(async (force = false) => {
    if (!token) return;
    if (hasFetched && !force) return;

    try {
      setLoading(true);
      setError(null);
      const data = await notificationsApi.getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setHasFetched(true);
      setUnreadCount(list.filter(n => n && !n.is_read).length);
    } catch (err) {
      console.error("Failed to fetch notifications inside context:", err);
      setNotifications([]);
      setUnreadCount(0);
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [token, hasFetched]);

  const markAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => (Array.isArray(prev) ? prev.map(n => n.id === id ? { ...n, is_read: true } : n) : []));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => (Array.isArray(prev) ? prev.map(n => ({ ...n, is_read: true })) : []));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
