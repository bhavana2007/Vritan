import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { API_BASE, parseFastApiDetail } from "../api";

import { Sidebar } from "./admin/components/Sidebar";
import { ConfirmationModal } from "./admin/components/ConfirmationModal";

import { useAdminDashboard } from "./admin/hooks/useAdminDashboard";
import { useVerification } from "./admin/hooks/useVerification";

import { DashboardPanel } from "./admin/DashboardPanel";
import { VerificationPanel } from "./admin/VerificationPanel";
import { DirectoriesPanel } from "./admin/DirectoriesPanel";
import { AIAnalyticsPanel } from "./admin/AIAnalyticsPanel";
import { AuditLogsPanel } from "./admin/AuditLogsPanel";
import { SettingsPanel } from "./admin/SettingsPanel";
import { SystemHealthPanel } from "./admin/SystemHealthPanel";

import React, { useEffect } from "react";

// Reusable Verification Document View Modal
function VerificationDocModal({ token, docType, entityId, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    setError("");

    fetch(`${API_BASE}/admin/verification-document/${docType}/${entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(parseFastApiDetail(data) || "File not found");
        }
        const blob = await res.blob();
        setUrl(URL.createObjectURL(blob));
      })
      .catch((err) => setError(err.message || "Could not load document"))
      .finally(() => setLoading(false));

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [entityId, docType, token]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Verification Document</h2>
          <div className="flex gap-2 items-center">
            {url && (
              <a
                href={url}
                download="verification_document"
                className="px-3 py-1.5 border border-blue-200 text-xs font-bold rounded-xl text-blue-700 hover:bg-blue-50"
              >
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-900 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-slate-50">
          {loading && (
            <div className="flex items-center justify-center h-48 text-slate-500">
              Loading document...
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">{error}</div>
          )}
          {url && !loading && (
            url.includes("pdf") || url.endsWith(".pdf") ? (
              <iframe
                src={url}
                className="w-full rounded-xl border border-slate-200"
                style={{ height: "65vh" }}
                title="Verification Document"
              />
            ) : (
              <img
                src={url}
                alt="Verification Document"
                className="max-w-full mx-auto rounded-xl border border-slate-200 shadow"
              />
            )
          )}
          {url && !loading && (
            <object
              data={url}
              className="w-full rounded-xl border border-slate-200 mt-2"
              style={{ height: "65vh", display: "block" }}
              aria-label="Verification document viewer"
            >
              <p className="text-center text-slate-500 py-8">
                Cannot preview this file type.{" "}
                <a href={url} download className="text-emerald-600 font-bold hover:underline">Download instead</a>
              </p>
            </object>
          )}
        </div>
      </div>
    </div>
  );
}

function Admin() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Notifications Toast State
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'loading' }

  // Action Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    orgType: "",
    orgId: "",
    action: "",
    reason: "",
  });

  // View Doc Modal State
  const [docModal, setDocModal] = useState(null); // { docType, entityId }

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    if (type !== "loading") {
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Instantiate hooks containing centralized state machine operations
  const { stats, health, loading: dashLoading, refreshData } = useAdminDashboard(token);
  const { pendingData, auditLogs, loading: verifLoading, handleAction, processingId } = useVerification(token);

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  // Pre-action triggers displaying confirmation modal
  const triggerAction = (orgType, orgId, action, reason) => {
    const formattedActionText = action === "APPROVE" ? "approve and assign a Vritan ID to" : action === "REJECT" ? "reject" : "suspend";
    setConfirmModal({
      isOpen: true,
      title: "Confirm Dashboard Action",
      message: `Are you sure you want to ${formattedActionText} this stakeholder organization record? This action will write security logs in the audit trace.`,
      orgType,
      orgId,
      action,
      reason,
    });
  };

  const confirmActionExecution = async () => {
    const { orgType, orgId, action, reason } = confirmModal;
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    showToast("Processing request...", "loading");

    try {
      await handleAction(orgType, orgId, action, reason);
      showToast(`Action ${action.toLowerCase()} completed successfully.`, "success");
      refreshData();
    } catch (err) {
      showToast(`Action failed: ${err.message || "Unknown error"}`, "error");
    }
  };

  const renderActivePanel = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardPanel stats={stats} onNavigate={setActiveTab} />;
      case "verification":
        return (
          <VerificationPanel
            pendingData={pendingData}
            loading={verifLoading}
            onAction={triggerAction}
            processingId={processingId}
            onViewDoc={(docType, entityId) => setDocModal({ docType, entityId })}
          />
        );
      case "directories":
        return <DirectoriesPanel token={token} />;
      case "ai_analytics":
        return <AIAnalyticsPanel />;
      case "health":
        return <SystemHealthPanel health={health} />;
      case "audit_logs":
        return <AuditLogsPanel auditLogs={auditLogs} loading={verifLoading} />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <DashboardPanel stats={stats} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
      {/* Dynamic Sidebar menu */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role="SUPER_ADMIN"
        user={user}
        onLogout={handleLogout}
      />

      {/* Main page content area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Notification Bar */}
        {toast && (
          <div className="absolute top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`px-4 py-3 rounded-xl shadow-lg text-xs font-bold border flex items-center gap-2 ${
              toast.type === "success" ? "bg-green-50 text-green-800 border-green-200" :
              toast.type === "error" ? "bg-red-50 text-red-800 border-red-200" :
              "bg-blue-50 text-blue-800 border-blue-200"
            }`}>
              {toast.type === "loading" && <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current"></span>}
              {toast.message}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto">
          {renderActivePanel()}
        </div>
      </main>

      {/* Confirmation overlays and View Document Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmActionExecution}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        confirmText="Execute Action"
        isProcessing={processingId !== null}
      />

      {docModal && (
        <VerificationDocModal
          token={token}
          docType={docModal.docType}
          entityId={docModal.entityId}
          onClose={() => setDocModal(null)}
        />
      )}
    </div>
  );
}

export default Admin;
