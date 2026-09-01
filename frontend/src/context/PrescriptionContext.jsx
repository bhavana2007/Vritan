import React, { createContext, useContext, useState, useCallback } from 'react';
import { prescriptionsApi } from '../api/prescriptions';
import { useAuth } from '../hooks/useAuth';

const PrescriptionContext = createContext(null);

export function PrescriptionProvider({ children }) {
  const { token } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchPrescriptions = useCallback(async (force = false) => {
    if (!token) return;
    if (hasFetched && !force) return;

    try {
      setLoading(true);
      setError(null);
      const data = await prescriptionsApi.getPrescriptions();
      setPrescriptions(Array.isArray(data) ? data : []);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prescriptions');
    } finally {
      setLoading(false);
    }
  }, [token, hasFetched]);

  const value = {
    prescriptions,
    loading,
    error,
    fetchPrescriptions
  };

  return (
    <PrescriptionContext.Provider value={value}>
      {children}
    </PrescriptionContext.Provider>
  );
}

export const usePrescriptions = () => {
  const context = useContext(PrescriptionContext);
  if (!context) throw new Error("usePrescriptions must be used within PrescriptionProvider");
  return context;
};
