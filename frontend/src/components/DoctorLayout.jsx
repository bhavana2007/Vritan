import { Outlet } from "react-router-dom";
import DoctorSidebar from "./DoctorSidebar";

function DoctorLayout({ children, currentPage }) {
  return (
    <div className="flex min-h-screen h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden">
      {/* Shared Desktop & Mobile Doctor Sidebar */}
      <DoctorSidebar currentPage={currentPage} />

      {/* Main Content Area - Always offset after sidebar, never overlapping */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0">
        {children || <Outlet />}
      </main>
    </div>
  );
}

export default DoctorLayout;
