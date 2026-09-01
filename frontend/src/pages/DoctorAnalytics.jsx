import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE } from "../api";
import { useAuth } from "../hooks/useAuth";
import DoctorSidebar from "../components/DoctorSidebar";

function DoctorAnalytics() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState("week");
  const cache = useRef({});
  const [analyticsData, setAnalyticsData] = useState({
    patientsSeen: [],
    prescriptionTrends: [],
    commonDiagnoses: [],
    commonMedicines: [],
    followUpCompletion: 0,
    recordUploads: [],
    patientGrowth: [],
  });

  useEffect(() => {
    async function fetchAnalytics() {
      if (!token) return;
      if (cache.current[timeRange]) {
        setAnalyticsData(cache.current[timeRange]);
        setLoading(false);
        setError("");
        return;
      }
      if (!token) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/doctor/metrics?time_range=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error("Unable to calculate analytics at the moment.");
        }
        cache.current[timeRange] = data;
        setAnalyticsData(data);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [token, timeRange]);

  const timeRanges = [
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <DoctorSidebar currentPage="analytics" />
        <main className="flex-1 p-8 min-w-0">
          <div className="flex items-center justify-center h-full">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar currentPage="analytics" />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
            <p className="mt-2 text-slate-600">Detailed insights into your practice patterns and trends.</p>
          </div>

          {error ? (
            <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
              <h3 className="text-lg font-bold text-red-700 mb-2">Analytics unavailable</h3>
              <p className="text-red-600">{error}</p>
              <p className="text-red-500 text-sm mt-2">Please try again later.</p>
            </div>
          ) : null}

          {/* Time Range Filter */}
          <div className="mb-8 flex items-center gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  timeRange === range.id
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500">Total Patients</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {analyticsData.patientGrowth?.length
                  ? analyticsData.patientGrowth[analyticsData.patientGrowth.length - 1].count
                  : 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500">Follow-up Rate</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{analyticsData.followUpCompletion || 0}%</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-violet-50 rounded-xl">
                  <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500">Prescriptions</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {analyticsData.prescriptionTrends?.reduce((sum, item) => sum + item.count, 0) || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-50 rounded-xl">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500">Top Diagnosis</span>
              </div>
              <p className="text-xl font-bold text-slate-900 truncate" title={analyticsData.commonDiagnoses?.[0]?.diagnosis || "None"}>
                {analyticsData.commonDiagnoses?.[0]?.diagnosis || "None"}
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Patients Seen Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Patients Seen by {timeRange}</h3>
              {analyticsData.patientsSeen?.length > 0 ? (
                <div className="flex items-end h-64 gap-2 w-full pt-4">
                  {analyticsData.patientsSeen.map((item, index) => {
                    const max = Math.max(...analyticsData.patientsSeen.map(p => p.count));
                    const height = max > 0 ? (item.count / max) * 100 : 0;
                    return (
                      <div key={index} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                        <div 
                          className="w-full max-w-[40px] bg-emerald-500 rounded-t-sm hover:bg-emerald-600 transition-colors cursor-pointer"
                          style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                          title={`${item.period}: ${item.count} patients`}
                        ></div>
                        <span className="text-xs text-slate-500 mt-2 truncate w-full text-center" title={item.period}>{item.period}</span>
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                          {item.count} patients
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">No data available</p>
                  <p className="text-sm text-slate-500 mt-1">Start seeing patients to view analytics</p>
                </div>
              )}
            </div>

            {/* Prescription Trends */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Prescription Trends</h3>
              {analyticsData.prescriptionTrends?.length > 0 ? (
                <div className="flex items-end h-64 gap-2 w-full pt-4">
                  {analyticsData.prescriptionTrends.map((item, index) => {
                    const max = Math.max(...analyticsData.prescriptionTrends.map(p => p.count));
                    const height = max > 0 ? (item.count / max) * 100 : 0;
                    return (
                      <div key={index} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                        <div 
                          className="w-full max-w-[40px] bg-violet-500 rounded-t-sm hover:bg-violet-600 transition-colors cursor-pointer"
                          style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                          title={`${item.period}: ${item.count} prescriptions`}
                        ></div>
                        <span className="text-xs text-slate-500 mt-2 truncate w-full text-center" title={item.period}>{item.period}</span>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                          {item.count} px
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">No data available</p>
                  <p className="text-sm text-slate-500 mt-1">Create prescriptions to view trends</p>
                </div>
              )}
            </div>
          </div>

          {/* Common Diagnoses and Medicines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Most Common Diagnoses */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Most Common Diagnoses</h3>
              {analyticsData.commonDiagnoses?.length > 0 ? (
                <div className="space-y-3">
                  {analyticsData.commonDiagnoses.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{item.diagnosis}</span>
                      </div>
                      <span className="text-sm text-slate-600">{item.count} cases</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">No diagnoses recorded</p>
                  <p className="text-sm text-slate-500 mt-1">Add diagnoses to your prescriptions to see patterns</p>
                </div>
              )}
            </div>

            {/* Most Prescribed Medicines */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Most Prescribed Medicines</h3>
              {analyticsData.commonMedicines?.length > 0 ? (
                <div className="space-y-3">
                  {analyticsData.commonMedicines.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-900">{item.medicine}</span>
                      </div>
                      <span className="text-sm text-slate-600">{item.count} times</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium">No medicines prescribed</p>
                  <p className="text-sm text-slate-500 mt-1">Prescribe medicines to see frequently used ones</p>
                </div>
              )}
            </div>
          </div>

          {/* Patient Growth */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Patient Growth Over Time</h3>
            {analyticsData.patientGrowth?.length > 0 ? (
              <div className="flex items-end h-72 gap-2 w-full pt-4">
                {analyticsData.patientGrowth.map((item, index) => {
                  const max = Math.max(...analyticsData.patientGrowth.map(p => p.count));
                  const height = max > 0 ? (item.count / max) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                      <div 
                        className="w-full max-w-[60px] bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors cursor-pointer"
                        style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                        title={`${item.period}: ${item.count} cumulative patients`}
                      ></div>
                      <span className="text-xs text-slate-500 mt-2 truncate w-full text-center" title={item.period}>{item.period}</span>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                        Total: {item.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">No patient growth data</p>
                <p className="text-sm text-slate-500 mt-1">Approve patient access requests to track your practice growth</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DoctorAnalytics;
