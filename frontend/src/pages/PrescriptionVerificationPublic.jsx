import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { prescriptionsApi } from "../api/prescriptions";
import LoadingSkeleton from "../components/LoadingSkeleton";

function PrescriptionVerificationPublic() {
  const { verificationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function verifyPrescription() {
      setLoading(true);
      setError("");
      setAuthError(false);
      try {
        const result = await prescriptionsApi.verifyQR(verificationId);
        setData(result);
      } catch (err) {
        console.error(err);
        if (err.status === 401 || err.status === 403) {
          setAuthError(true);
        } else {
          setError(err.message || "Failed to load prescription verification details.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (verificationId) {
      verifyPrescription();
    }
  }, [verificationId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg p-6">
          <LoadingSkeleton type="card" count={1} />
          <p className="text-center text-slate-500 text-sm font-semibold mt-4">Validating prescription authenticity...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg p-6 text-center select-none">
          <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v3m0-3h3m-3 0H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Authentication Required</h2>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            To view these verified prescription details, you must be signed in as an authorized pharmacist or medical professional.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/login" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors text-center block">
              Sign In to Vritan
            </Link>
            <Link to="/" className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors text-center block">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Verification Failed</h2>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            {error || "The requested prescription verification code could not be resolved or is invalid."}
          </p>
          <Link to="/" className="mt-6 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors text-center block">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const isInvalid = !data.valid;
  const statusLabel = data.status === "revoked" ? "Revoked" : data.status === "expired" ? "Expired" : "Invalid";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-2xl p-6">
        
        {/* Header Indicator */}
        {isInvalid ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-center mb-6">
            <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-red-900">Verification Inactive ({statusLabel})</h2>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              This prescription verification code was revoked or has expired. Pharmacies are instructed not to dispense medication based on this scannable token.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center mb-6">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-emerald-900">Prescription Authenticated & Valid</h2>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Protected by Vritan secure cryptographic records verification. Hand over matching clinical authorization to complete dispensing.
            </p>
          </div>
        )}

        {/* Prescription Metadata (Doctor/Hospital) */}
        {!isInvalid && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 font-bold tracking-wider uppercase block">Issuing Practitioner</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">{data.issued_by}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold tracking-wider uppercase block">Clinic / Hospital</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">{data.organization}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold tracking-wider uppercase block">Prescription Reference</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block font-mono">{data.prescription_reference}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold tracking-wider uppercase block">Issue Date</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">
                  {data.issued_at ? new Date(data.issued_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "N/A"}
                </span>
              </div>
            </div>

            {/* Medicines List */}
            <div className="mt-6">
              <span className="text-xs text-slate-400 font-bold tracking-wider uppercase block mb-3">Dispensing Medicines List</span>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider text-left">
                    <tr>
                      <th className="px-4 py-3">Medicine Name</th>
                      <th className="px-4 py-3">Dosage</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                    {data.medicines && data.medicines.length > 0 ? (
                      data.medicines.map((med, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-slate-900 font-bold">{med.name}</td>
                          <td className="px-4 py-3">{med.dosage || "As advised"}</td>
                          <td className="px-4 py-3">{med.frequency || "N/A"}</td>
                          <td className="px-4 py-3">{med.duration || "N/A"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 italic">No medications recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold">
          <span>Protected Audited Verification</span>
          <Link to="/" className="text-blue-600 hover:text-blue-700">Go to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default PrescriptionVerificationPublic;
