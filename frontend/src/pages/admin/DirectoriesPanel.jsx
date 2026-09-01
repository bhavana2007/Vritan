import React, { useState, useEffect, useCallback } from "react";
import { DataTable } from "./components/DataTable";
import { StatusBadge } from "./components/StatusBadge";
import { SearchBar } from "./components/SearchBar";
import { adminService } from "./services/adminService";

export function DirectoriesPanel({ token }) {
  const [activeTab, setActiveTab] = useState("doctors"); // 'doctors' | 'patients' | 'labs'
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "doctors") {
        const res = await adminService.getDoctors(token, "all");
        setData(res);
      } else if (activeTab === "labs") {
        const res = await adminService.getLaboratories(token, "all");
        setData(res);
      } else {
        // Patients mock dataset for visualization
        setData([
          { id: 1, name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "9876543210", gender: "Male", vritan_id: "PAT-000041" },
          { id: 2, name: "Diya Patel", email: "diya.patel@example.com", phone: "9876543211", gender: "Female", vritan_id: "PAT-000042" },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = data.filter((item) => {
    const term = searchTerm.toLowerCase();
    const name = (item.full_name || item.name || "").toLowerCase();
    const email = (item.email || item.technician_email || "").toLowerCase();
    const vritanId = (item.vritan_id || "").toLowerCase();
    return name.includes(term) || email.includes(term) || vritanId.includes(term);
  });

  const getHeaders = () => {
    if (activeTab === "doctors") return ["Name", "Email", "Phone", "Specialization", "Licence", "Status"];
    if (activeTab === "labs") return ["Lab Name", "Email", "License", "Address", "Status"];
    return ["Patient Name", "Email", "Phone", "Gender", "Vritan ID"];
  };

  const renderRow = (item, idx) => {
    if (activeTab === "doctors") {
      return (
        <tr key={item.user_id || idx} className="hover:bg-slate-50">
          <td className="px-5 py-4 font-bold text-slate-900">{item.full_name}</td>
          <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
          <td className="px-5 py-4 text-xs font-mono font-bold text-slate-500">{item.phone || "N/A"}</td>
          <td className="px-5 py-4 text-xs font-semibold text-slate-600">{item.specialization || "General"}</td>
          <td className="px-5 py-4 text-xs font-mono text-slate-500">{item.medical_license_number}</td>
          <td className="px-5 py-4"><StatusBadge status={item.verification_status} /></td>
        </tr>
      );
    }
    if (activeTab === "labs") {
      return (
        <tr key={item.id || idx} className="hover:bg-slate-50">
          <td className="px-5 py-4 font-bold text-slate-900">{item.name}</td>
          <td className="px-5 py-4 font-semibold text-slate-600">{item.technician_email || item.email}</td>
          <td className="px-5 py-4 text-xs font-mono text-slate-500">{item.license_number}</td>
          <td className="px-5 py-4 text-xs text-slate-600 truncate max-w-xs">{item.address}</td>
          <td className="px-5 py-4"><StatusBadge status={item.verification_status} /></td>
        </tr>
      );
    }
    return (
      <tr key={item.id || idx} className="hover:bg-slate-50">
        <td className="px-5 py-4 font-bold text-slate-900">{item.name}</td>
        <td className="px-5 py-4 font-semibold text-slate-600">{item.email}</td>
        <td className="px-5 py-4 text-xs font-mono text-slate-500">{item.phone}</td>
        <td className="px-5 py-4 text-xs font-semibold text-slate-600">{item.gender}</td>
        <td className="px-5 py-4 font-mono text-xs font-bold text-emerald-700">{item.vritan_id}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stakeholder Registry</h1>
        <p className="text-xs font-semibold text-slate-500">Access registered profiles, contact details, and current verification states.</p>
      </div>

      <div className="flex border-b border-slate-200/80 gap-1">
        {["doctors", "patients", "labs"].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSearchTerm(""); }}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all capitalize ${
              activeTab === tab
                ? "border-emerald-600 text-emerald-600 font-extrabold"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <SearchBar value={searchTerm} onChange={setSearchTerm} placeholder={`Search registry ${activeTab}...`} />
      </div>

      <DataTable
        headers={getHeaders()}
        data={filteredData}
        renderRow={renderRow}
        loading={loading}
        emptyMessage={`No ${activeTab} records found matching details.`}
      />
    </div>
  );
}
