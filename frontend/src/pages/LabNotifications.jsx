import SharedNotifications from "../components/SharedNotifications";
import LabSidebar from "../components/LabSidebar";

function LabNotifications() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <LabSidebar currentPage="notifications" />
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 mt-1">Stay updated with lab alerts</p>
          </div>
          
          <SharedNotifications />
        </div>
      </div>
    </div>
  );
}

export default LabNotifications;
