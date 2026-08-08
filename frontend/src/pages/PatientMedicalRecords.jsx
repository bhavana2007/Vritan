import React, { useEffect, useState } from "react";
import MedicalRecordCard from "../components/MedicalRecordCard";
import SecureFileViewer from "../components/SecureFileViewer";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useMedicalRecords } from "../context/MedicalRecordContext";
import { recordsApi } from "../api/records";

function PatientMedicalRecords() {
  const { records, loading: recordsLoading, error: contextError, fetchRecords, addRecord, removeRecord } = useMedicalRecords();
  const [uploading, setUploading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [recordType, setRecordType] = useState("prescription");
  const [recordFile, setRecordFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordSearchFilter, setRecordSearchFilter] = useState("all");
  const [viewingRecordId, setViewingRecordId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleFileSelection(file) {
    setUploadMessage("");
    setRecordsError("");
    if (!file) {
      setRecordFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setRecordsError("File size should be less than 10MB.");
      setToast({ type: "danger", message: "File size should be less than 10MB." });
      setRecordFile(null);
      return;
    }
    setRecordFile(file);
  }

  async function handleRecordUpload(e) {
    e.preventDefault();
    if (!recordFile) {
      setRecordsError("Choose an image or PDF before uploading.");
      return;
    }
    const formData = new FormData();
    formData.append("record_type", recordType);
    formData.append("notes", notes);
    formData.append("file", recordFile);
    setUploading(true);
    setRecordsError("");
    setUploadMessage("");
    try {
      const data = await recordsApi.uploadRecord(formData);
      addRecord(data);
      setRecordFile(null);
      setNotes("");
      setUploadMessage("Medical record uploaded successfully with OCR analysis.");
      setToast({ type: "success", message: "Medical record uploaded successfully with OCR analysis." });
    } catch (error) {
      const message = "Unable to process this file. Please try another PDF or image.";
      setRecordsError(message);
      setToast({ type: "danger", message });
    } finally {
      setUploading(false);
    }
  }

  async function handleViewRecord(record) {
    setViewingRecordId(record.id);
    setRecordsError("");
    try {
      // recordsApi.getRecordPreview calls apiClient.downloadFile and returns a Blob
      const data = await recordsApi.getRecordPreview(record.file_url);

      const objectUrl = window.URL.createObjectURL(data);
      setViewerFile({ url: objectUrl, filename: record.original_filename, mimeType: data.type || "" });
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : "Could not open this file.");
    } finally {
      setViewingRecordId(null);
    }
  }

  function closeViewer() {
    if (viewerFile?.url) window.URL.revokeObjectURL(viewerFile.url);
    setViewerFile(null);
  }

  async function confirmDeleteRecord() {
    if (!deleteCandidate) return;
    setDeletingRecordId(deleteCandidate.id);
    setRecordsError("");
    try {
      await recordsApi.deleteRecord(deleteCandidate.id);
      removeRecord(deleteCandidate.id);
      setDeleteCandidate(null);
      setToast({ type: "success", message: "Medical record deleted permanently." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete this medical record.";
      setRecordsError(message);
      setToast({ type: "danger", message });
    } finally {
      setDeletingRecordId(null);
    }
  }

  const recordsList = Array.isArray(records) ? records : [];

  const groupedRecords = recordsList.reduce((groups, record) => {
    if (!record) return groups;
    const date = new Date(record.uploaded_at);
    const label = Number.isNaN(date.getTime())
      ? "Undated"
      : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(record);
    return groups;
  }, {});

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Medical Records</h1>
        <p className="text-slate-500">Upload prescriptions, reports, scans, and other documents.</p>
      </div>

      {toast && (
        <div className={`mb-6 p-4 rounded-xl font-medium ${toast.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {toast.message}
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-slate-900">Delete Record</h2>
            <p className="mt-3 text-slate-500 text-sm">
              Are you sure you want to permanently delete this medical record? The file, OCR text, and AI metadata will be removed.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteCandidate(null)} disabled={deletingRecordId === deleteCandidate.id} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteRecord} disabled={deletingRecordId === deleteCandidate.id} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium transition-colors">
                {deletingRecordId === deleteCandidate.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SecureFileViewer file={viewerFile} onClose={closeViewer} />

      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input type="search" placeholder="Search medicines, conditions, notes, or OCR text" value={recordSearch} onChange={(e) => setRecordSearch(e.target.value)} className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={recordSearchFilter} onChange={(e) => setRecordSearchFilter(e.target.value)} className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none sm:max-w-48 bg-white">
            <option value="all">All tags</option>
            <option value="medicine">Medicine</option>
            <option value="condition">Condition</option>
            <option value="ocr">OCR text</option>
            <option value="month">Upload month</option>
            <option value="type">Record type</option>
          </select>
          <button type="button" onClick={() => fetchRecords(true)} disabled={recordsLoading} className="px-6 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors">
            Refresh
          </button>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {["prescription", "blood report", "fever"].map((chip) => (
            <button key={chip} type="button" onClick={() => setRecordSearch(chip)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-full transition-colors">
              {chip}
            </button>
          ))}
        </div>

        <form onSubmit={handleRecordUpload} className="mb-8 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)} disabled={uploading} className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="prescription">Prescription</option>
              <option value="report">Report</option>
              <option value="scan">Scan</option>
              <option value="other">Other</option>
            </select>
            <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={uploading} className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 rounded-xl cursor-pointer font-medium transition-colors">
              Upload Image/PDF
              <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileSelection(e.target.files?.[0])} disabled={uploading} className="sr-only" />
            </label>
            <label className="flex items-center justify-center px-4 py-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer font-medium transition-colors">
              Camera Capture
              <input type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => handleFileSelection(e.target.files?.[0])} disabled={uploading} className="sr-only" />
            </label>
          </div>
          {recordFile && <p className="p-3 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">Selected file: {recordFile.name}</p>}
          <button type="submit" disabled={uploading} className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
            {uploading ? "Uploading & Analyzing..." : "Save Medical Record"}
          </button>
        </form>

        {uploadMessage && <p className="mb-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl">{uploadMessage}</p>}
        {(recordsError || contextError) && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
            <p>{recordsError || contextError}</p>
            <button type="button" onClick={() => { setRecordsError(""); fetchRecords(true); }} className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors">
              Retry
            </button>
          </div>
        )}

        {recordsLoading && <div className="mt-4"><LoadingSkeleton type="card" count={3} /></div>}

        {!recordsLoading && recordsList.length === 0 && !(recordsError || contextError) && (
          <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl mt-6">
            <span className="text-5xl mb-4 block">🛡️</span>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No medical records found.</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Upload your first prescription, laboratory report, or diagnostic report.</p>
          </div>
        )}

        {!recordsLoading && recordsList.length > 0 && (
          <div className="space-y-8 mt-8">
            {Object.entries(groupedRecords).map(([monthLabel, monthRecords]) => (
              <div key={monthLabel}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">{monthLabel}</h3>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">{(Array.isArray(monthRecords) ? monthRecords.length : 0)} records</span>
                </div>
                <div className="space-y-4">
                  {Array.isArray(monthRecords) && monthRecords.map((record) => (
                    <MedicalRecordCard
                      key={record?.id || Math.random()}
                      record={record}
                      searchQuery={recordSearch}
                      onView={handleViewRecord}
                      onDelete={setDeleteCandidate}
                      viewing={viewingRecordId === record?.id}
                      deleting={deletingRecordId === record?.id}
                      showDelete
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default PatientMedicalRecords;
