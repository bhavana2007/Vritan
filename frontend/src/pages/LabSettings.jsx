import SharedSettings from "../components/SharedSettings";
import LabSidebar from "../components/LabSidebar";

function LabSettings() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <LabSidebar currentPage="settings" />
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 mt-1">Manage your laboratory account preferences</p>
          </div>
          
          <SharedSettings userRole="lab_tech" />
        </div>
      </div>
    </div>
  );
}

export default LabSettings;
