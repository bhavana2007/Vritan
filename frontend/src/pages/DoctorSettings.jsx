import DoctorSidebar from "../components/DoctorSidebar";
import SharedSettings from "../components/SharedSettings";

function DoctorSettings() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar currentPage="settings" />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="mt-2 text-slate-600">Manage your account preferences and security.</p>
          </div>

          <SharedSettings userRole="doctor" />
        </div>
      </main>
    </div>
  );
}

export default DoctorSettings;
