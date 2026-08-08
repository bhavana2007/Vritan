import React, { createContext, useContext, useState, useCallback } from 'react';
import { recordsApi } from '../api/records';
import { useAuth } from '../hooks/useAuth';

const MedicalRecordContext = createContext(null);

export function MedicalRecordProvider({ children }) {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const normalizeRecord = useCallback((record) => {
    if (!record) return null;

    let structured = {};
    if (record.ai_structured_data) {
      if (typeof record.ai_structured_data === "object") {
        structured = record.ai_structured_data;
      } else if (typeof record.ai_structured_data === "string") {
        try {
          structured = JSON.parse(record.ai_structured_data) || {};
        } catch (e) {
          structured = {};
        }
      }
    }

    let medicines = [];
    if (record.detected_medicines) {
      if (Array.isArray(record.detected_medicines)) {
        medicines = record.detected_medicines;
      } else if (typeof record.detected_medicines === "string") {
        try {
          medicines = JSON.parse(record.detected_medicines);
          if (!Array.isArray(medicines)) {
            medicines = [];
          }
        } catch (e) {
          medicines = [];
        }
      }
    }

    let conditions = [];
    if (record.probable_conditions) {
      if (Array.isArray(record.probable_conditions)) {
        conditions = record.probable_conditions;
      } else if (typeof record.probable_conditions === "string") {
        try {
          conditions = JSON.parse(record.probable_conditions);
          if (!Array.isArray(conditions)) {
            conditions = [];
          }
        } catch (e) {
          conditions = [];
        }
      }
    }

    return {
      ...record,
      ai_structured_data: structured,
      detected_medicines: medicines,
      probable_conditions: conditions,
      uploaded_at: record.uploaded_at || new Date().toISOString()
    };
  }, []);

  const fetchRecords = useCallback(async (force = false) => {
    if (!token) return;
    if (hasFetched && !force) return;

    try {
      setLoading(true);
      setError(null);
      const data = await recordsApi.getRecords();
      const rawRecords = Array.isArray(data) ? data : [];
      const normalized = rawRecords.map(r => normalizeRecord(r)).filter(Boolean);
      setRecords(normalized);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load medical records');
    } finally {
      setLoading(false);
    }
  }, [token, hasFetched, normalizeRecord]);

  const addRecord = (record) => {
    if (!record) return;
    const normalized = normalizeRecord(record);
    if (normalized) {
      setRecords(prev => [normalized, ...prev]);
    }
  };

  const removeRecord = (id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const value = {
    records,
    loading,
    error,
    fetchRecords,
    addRecord,
    removeRecord
  };

  return (
    <MedicalRecordContext.Provider value={value}>
      {children}
    </MedicalRecordContext.Provider>
  );
}

export const useMedicalRecords = () => {
  const context = useContext(MedicalRecordContext);
  if (!context) throw new Error("useMedicalRecords must be used within MedicalRecordProvider");
  return context;
};
