import SharedNotifications from "../components/SharedNotifications";

function PatientNotifications() {
  return (
    <div className="animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 mt-1">Stay updated with your latest alerts and records</p>
          </div>
          
          <SharedNotifications />
        </div>
    </div>
  );
}

export default PatientNotifications;
