import { useState, useEffect, useCallback } from "react";
import { adminService } from "../services/adminService";

export function useAdminDashboard(token) {
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalHospitals: 0,
    totalLaboratories: 0,
    totalPharmacies: 0,
    pendingVerifications: 0,
    activePatients: 2450, // Mock metric
    apiRequestsToday: 12450, // Mock metric
    avgConfidence: 94.2, // Mock metric
  });
  const [health, setHealth] = useState({
    database: "healthy",
    firebase: "healthy",
    gemini: "healthy",
    ocr: "healthy",
    email: "healthy",
    queueLength: 0,
    storageUsage: "42%",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      // Load verification counts to compute exact stats
      const [pendingOrgs, allDocs, allLabs] = await Promise.all([
        adminService.getPendingOrganizations(token).catch(() => ({ hospitals: [], pharmacies: [], government_authorities: [], doctors: [] })),
        adminService.getDoctors(token, "all").catch(() => []),
        adminService.getLaboratories(token, "all").catch(() => []),
      ]);

      const pendingCount = 
        (pendingOrgs.hospitals?.length || 0) +
        (pendingOrgs.pharmacies?.length || 0) +
        (pendingOrgs.government_authorities?.length || 0) +
        (pendingOrgs.doctors?.length || 0);

      setStats((prev) => ({
        ...prev,
        totalDoctors: allDocs.length || 0,
        totalLaboratories: allLabs.length || 0,
        pendingVerifications: pendingCount,
        totalHospitals: 12, // Mock static base
        totalPharmacies: 8, // Mock static base
      }));
    } catch (err) {
      setError(err.message || "Failed to sync admin metrics.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return { stats, health, loading, error, refreshData };
}
