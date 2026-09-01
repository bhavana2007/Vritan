import { useEffect, useState } from "react";
import { apiClient } from "../api/client";

function GovernmentDashboard() {
  const [stats, setStats] = useState({
    total_hospitals: 142,
    active_pharmacies: 88,
    regional_consultations: 12450,
    anonymized_patients: 45200,
  });

  const [diseaseTrends, setDiseaseTrends] = useState([
    { disease: "Acute Febrile Illness / Seasonal Fever", cases: 3420, trend: "+4.2%", status: "Monitored" },
    { disease: "Upper Respiratory Tract Infection", cases: 2180, trend: "-1.5%", status: "Stable" },
    { disease: "Hypertension / Essential HBP", cases: 5890, trend: "+0.8%", status: "Managed" },
    { disease: "Type 2 Diabetes Mellitus", cases: 4120, trend: "+1.1%", status: "Managed" },
  ]);

  const [hospitalUtilization, setHospitalUtilization] = useState([
    { region: "Mumbai Central", bed_occupancy: "78%", icu_capacity: "82%", daily_opd: 1420 },
    { region: "Pune Metropolitan", bed_occupancy: "65%", icu_capacity: "70%", daily_opd: 980 },
    { region: "Nagpur District", bed_occupancy: "54%", icu_capacity: "58%", daily_opd: 620 },
  ]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-blue-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Government Health Authority Portal
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-xs font-mono font-bold rounded border border-blue-200">
                VR-GOV-000001
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Anonymized Regional Public Health Intelligence & Epidemiological Analytics Hub.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <span>🔒</span> Strict Privacy Policy: 100% Anonymized (Zero PII Access)
          </div>
        </div>

        {/* Aggregate High-Level Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Hospitals</span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.total_hospitals}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Verified healthcare providers</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Pharmacies</span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.active_pharmacies}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Digital QR dispensation nodes</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly Consultations</span>
            <h2 className="text-3xl font-extrabold text-blue-700 mt-2">{stats.regional_consultations.toLocaleString()}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Anonymized OPD encounters</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Anonymized Population</span>
            <h2 className="text-3xl font-extrabold text-emerald-700 mt-2">{stats.anonymized_patients.toLocaleString()}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Epidemiological sample size</p>
          </div>
        </div>

        {/* Section 1: Regional Disease Trends */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📈</span> Anonymized Regional Disease Trends
            </h2>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Aggregation</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                <tr>
                  <th className="p-3.5">Diagnosed Disease Category</th>
                  <th className="p-3.5">Anonymized Case Count</th>
                  <th className="p-3.5">Weekly Trend</th>
                  <th className="p-3.5">Public Health Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {diseaseTrends.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{d.disease}</td>
                    <td className="p-3.5 font-mono text-slate-700">{d.cases.toLocaleString()}</td>
                    <td className={`p-3.5 font-bold text-xs ${d.trend.startsWith('+') ? 'text-red-600' : 'text-emerald-600'}`}>
                      {d.trend}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-xs font-semibold rounded-full border border-blue-200">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Regional Hospital Utilization */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🏥</span> Hospital Bed & Resource Utilization
            </h2>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                <tr>
                  <th className="p-3.5">Health Region</th>
                  <th className="p-3.5">Bed Occupancy Rate</th>
                  <th className="p-3.5">ICU Capacity Occupied</th>
                  <th className="p-3.5">Average Daily OPD Footfall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hospitalUtilization.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{h.region}</td>
                    <td className="p-3.5 font-semibold text-slate-700">{h.bed_occupancy}</td>
                    <td className="p-3.5 font-semibold text-slate-700">{h.icu_capacity}</td>
                    <td className="p-3.5 font-mono text-slate-700">{h.daily_opd.toLocaleString()} visits/day</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GovernmentDashboard;
