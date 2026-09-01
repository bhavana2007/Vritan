import DoctorSidebar from "../components/DoctorSidebar";
import SharedNotifications from "../components/SharedNotifications";

function DoctorNotifications() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar currentPage="notifications" />

      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
            <p className="mt-2 text-slate-600">Stay updated with your latest alerts and requests.</p>
          </div>

          <SharedNotifications />
        </div>
      </main>
    </div>
  );
}

export default DoctorNotifications;
