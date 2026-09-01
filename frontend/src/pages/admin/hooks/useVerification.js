import { useState, useEffect, useCallback } from "react";
import { adminService } from "../services/adminService";

export function useVerification(token) {
  const [pendingData, setPendingData] = useState({
    hospitals: [],
    pharmacies: [],
    government_authorities: [],
    doctors: [],
    laboratories: [],
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const fetchVerificationData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [pendingRes, logsRes, legacyDocs, legacyLabs] = await Promise.all([
        adminService.getPendingOrganizations(token).catch(() => ({ hospitals: [], pharmacies: [], government_authorities: [], doctors: [] })),
        adminService.getAuditLogs(token).catch(() => []),
        adminService.getDoctors(token, "pending").catch(() => []),
        adminService.getLaboratories(token, "pending").catch(() => []),
      ]);

      // Deduplicate/merge pending doctors & labs from both routes safely
      const mergedDocs = [...(pendingRes.doctors || [])];
      legacyDocs.forEach(d => {
        if (!mergedDocs.some(md => md.id === d.user_id)) {
          mergedDocs.push({
            id: d.user_id,
            name: d.full_name,
            email: d.email,
            vritan_id: d.vritan_id,
            status: d.verification_status,
            license: d.medical_license_number,
            hospital: d.hospital,
            docs: { verification_doc: d.verification_document_url }
          });
        }
      });

      const mergedLabs = [];
      legacyLabs.forEach(l => {
        mergedLabs.push({
          id: l.id,
          name: l.name,
          email: l.technician_email,
          vritan_id: l.vritan_id || "VR-PENDING",
          status: l.verification_status,
          license: l.license_number,
          docs: { verification_doc: l.verification_document_url }
        });
      });

      setPendingData({
        hospitals: pendingRes.hospitals || [],
        pharmacies: pendingRes.pharmacies || [],
        government_authorities: pendingRes.government_authorities || [],
        doctors: mergedDocs,
        laboratories: mergedLabs,
      });

      setAuditLogs(Array.isArray(logsRes) ? logsRes : []);
    } catch (err) {
      setError(err.message || "Failed to load verification logs.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleAction = async (orgType, orgId, action, reason = "") => {
    setProcessingId(`${orgType}-${orgId}`);
    try {
      if (orgType === "doctor" && (action === "APPROVE" || action === "REJECT")) {
        // Fallback or double action support for standard endpoints
        const queryAction = action === "APPROVE" ? "approve" : "reject";
        await adminService.updateDoctorStatus(token, orgId, queryAction);
      } else if (orgType === "laboratory" && (action === "APPROVE" || action === "REJECT")) {
        const queryAction = action === "APPROVE" ? "approve" : "reject";
        await adminService.updateLaboratoryStatus(token, orgId, queryAction);
      }
      
      // Execute the general organization status action endpoint
      const formattedType = orgType === "laboratory" ? "lab" : orgType;
      await adminService.performOrgAction(token, formattedType, orgId, action, reason);
      await fetchVerificationData();
    } catch (err) {
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    fetchVerificationData();
  }, [fetchVerificationData]);

  return { pendingData, auditLogs, loading, error, processingId, handleAction, refresh: fetchVerificationData };
}
