import React, { createContext, useContext, useState, useCallback } from 'react';
import { appointmentsApi } from '../api/appointments';
import { useAuth } from '../hooks/useAuth';

const AppointmentContext = createContext(null);

export function AppointmentProvider({ children }) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchAppointments = useCallback(async (force = false) => {
    if (!token) return;
    if (hasFetched && !force) return;

    try {
      setLoading(true);
      setError(null);
      const data = await appointmentsApi.getAppointments();
      setAppointments(Array.isArray(data) ? data : []);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, hasFetched]);

  const value = {
    appointments,
    loading,
    error,
    fetchAppointments
  };

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
}

export const useAppointments = () => {
  const context = useContext(AppointmentContext);
  if (!context) throw new Error("useAppointments must be used within AppointmentProvider");
  return context;
};
