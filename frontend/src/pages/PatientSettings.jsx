import SharedSettings from "../components/SharedSettings";

function PatientSettings() {
  return (
    <div className="animate-fade-in">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-500 mt-1">Manage your account preferences and security</p>
          </div>
          
          <SharedSettings userRole="patient" />
        </div>
    </div>
  );
}

export default PatientSettings;
