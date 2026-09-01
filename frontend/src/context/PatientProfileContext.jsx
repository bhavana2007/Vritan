import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { patientApi } from '../api/patient';
import { useAuth } from '../hooks/useAuth';

const PatientProfileContext = createContext(null);

export function PatientProfileProvider({ children }) {
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfileAndSummary = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // We can parallelize these eager requests. Handle errors individually to prevent full page failure.
      const [profileData, summaryData] = await Promise.all([
        patientApi.getProfile().catch(() => null),
        patientApi.getDashboardSummary().catch(() => ({}))
      ]);
      setProfile(profileData);
      setDashboardSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfileAndSummary();
  }, [fetchProfileAndSummary]);

  const value = {
    profile,
    dashboardSummary,
    loading,
    error,
    refreshProfile: fetchProfileAndSummary,
    setProfile
  };

  return (
    <PatientProfileContext.Provider value={value}>
      {children}
    </PatientProfileContext.Provider>
  );
}

export const usePatientProfile = () => {
  const context = useContext(PatientProfileContext);
  if (!context) throw new Error("usePatientProfile must be used within PatientProfileProvider");
  return context;
};
