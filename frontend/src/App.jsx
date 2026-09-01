import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import DoctorRegister from "./pages/DoctorRegister";

import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthProvider";
import Admin from "./pages/Admin";

import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import Doctor from "./pages/Doctor";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorPatients from "./pages/DoctorPatients";
import DoctorPatientRecord from "./pages/DoctorPatientRecord";
import DoctorProfile from "./pages/DoctorProfile";
import DoctorAppointments from "./pages/DoctorAppointments";
import DoctorSchedule from "./pages/DoctorSchedule";
import DoctorConsultation from "./pages/DoctorConsultation";
import DoctorPrescriptions from "./pages/DoctorPrescriptionsNew";
import DoctorCreatePrescription from "./pages/DoctorCreatePrescription";
import DoctorPrescriptionBuilder from "./pages/DoctorPrescriptionBuilder";
import DoctorAnalytics from "./pages/DoctorAnalytics";
import DoctorSettings from "./pages/DoctorSettings";
import DoctorNotifications from "./pages/DoctorNotifications";
import Login from "./pages/Login";
import PatientPrescriptions from "./pages/PatientPrescriptions";
import PatientProfile from "./pages/PatientProfile";
import PatientSettings from "./pages/PatientSettings";
import PatientNotifications from "./pages/PatientNotifications";
import Register from "./pages/Register";
import PatientRegister from "./pages/PatientRegister";
import HospitalRegister from "./pages/HospitalRegister";
import ApplicationStatus from "./pages/ApplicationStatus";
import SetupPassword from "./pages/SetupPassword";
import Upload from "./pages/Upload";
import PatientAppointments from "./pages/PatientAppointments";
import LabDashboard from "./pages/LabDashboard";
import LabPatientSearch from "./pages/LabPatientSearch";
import LabUploadReport from "./pages/LabUploadReport";
import LabUploadHistory from "./pages/LabUploadHistory";
import LabProfile from "./pages/LabProfile";
import LabSettings from "./pages/LabSettings";
import LabNotifications from "./pages/LabNotifications";
import LabQueue from "./pages/LabQueue";
import SampleCollection from "./pages/SampleCollection";
import LabResultWorkspace from "./pages/LabResultWorkspace";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import ManualPrescriptionEntry from "./pages/ManualPrescriptionEntry";
import OrgAdminDashboard from "./pages/OrgAdminDashboard";
import HospitalBranches from "./pages/HospitalBranches";
import HospitalDepartments from "./pages/HospitalDepartments";
import HospitalDoctors from "./pages/HospitalDoctors";
import OrgStaffManagement from "./pages/OrgStaffManagement";
import OrgMonitoringHub from "./pages/OrgMonitoringHub";
import OrgAdminAppointments from "./pages/organization/Appointments/Appointments";
import OrgAdminPatients from "./pages/organization/Patients/Patients";
import AdminDoctorScheduleView from "./pages/AdminDoctorScheduleView";
import OrgAdminLaboratories from "./pages/organization/Laboratories/Laboratories";
import OrgAdminPharmacies from "./pages/organization/Pharmacies/Pharmacies";
import OrgAdminMedicalRecords from "./pages/organization/MedicalRecords/MedicalRecords";
import OrgAdminAnalytics from "./pages/organization/Analytics/Analytics";
import NotificationCenter from "./pages/NotificationCenter";
import GovernmentDashboard from "./pages/GovernmentDashboard";
import JoinVritan from "./pages/JoinVritan";
import { getPatientRoutes } from "./routes/patientRoutes";
import PrescriptionVerificationPublic from "./pages/PrescriptionVerificationPublic";
import VoiceAssistant from "./components/VoiceAgent/VoiceAssistant";
import BranchAdminDashboard from "./pages/branch-admin/BranchAdminDashboard";
import DoctorTransferConfirm from "./pages/DoctorTransferConfirm";

function App() {
  return (
    <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/join" element={<JoinVritan />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/patient" element={<PatientRegister />} />
            <Route path="/register/doctor" element={<DoctorRegister />} />
            <Route path="/register/hospital" element={<HospitalRegister />} />
            <Route path="/register/:role" element={<Register />} />
            <Route path="/application-status" element={<ApplicationStatus />} />
            <Route path="/setup-password" element={<SetupPassword />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/verification"
              element={
                <ProtectedRoute allowedRoles={["admin"]} loginPath="/admin/login">
                  <Admin />
                </ProtectedRoute>
              }
            />
            
            {/* Modularized Patient Routes */}
            {getPatientRoutes()}
            
            <Route
              path="/voice"
              element={
                <ProtectedRoute allowedRoles={["patient"]}>
                  <VoiceAssistant />
                </ProtectedRoute>
              }
            />

            {/* Public Prescription QR Verification */}
            <Route path="/rx/:verificationId" element={<PrescriptionVerificationPublic />} />

            <Route
              path="/upload/:type"
              element={
                <ProtectedRoute allowedRoles={["patient"]}>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/dashboard"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/patients"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorPatients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/appointments"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorAppointments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/schedule"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorSchedule />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/consultation/:appointmentUid"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorConsultation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/patient/:patientUid"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorPatientRecord />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/prescriptions"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorPrescriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/prescriptions/create"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorCreatePrescription />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/prescription-builder/:appointmentId"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorPrescriptionBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/profile"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/analytics"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/settings"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/notifications"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]} loginPath="/admin/login">
                  <Admin />
                </ProtectedRoute>
              }
            />
            
            <Route path="/doctor/transfer-confirm" element={<DoctorTransferConfirm />} />

            <Route
              path="/lab/dashboard"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/patients"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabPatientSearch />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/upload"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabUploadReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/history"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabUploadHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/profile"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/settings"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/notifications"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/queue"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabQueue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/orders"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabQueue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/collection"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <SampleCollection />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab/results"
              element={
                <ProtectedRoute allowedRoles={["lab_tech"]}>
                  <LabResultWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pharmacy/dashboard"
              element={
                <ProtectedRoute allowedRoles={["pharmacist", "admin"]}>
                  <PharmacyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pharmacy/manual-entry"
              element={
                <ProtectedRoute allowedRoles={["pharmacist", "admin"]}>
                  <ManualPrescriptionEntry />
                </ProtectedRoute>
              }
            />
            {/* Organization Admin Portal */}
            <Route
              path="/org-admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/staff"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgStaffManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/branches"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <HospitalBranches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/departments"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <HospitalDepartments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/doctors"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <HospitalDoctors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/doctors/:doctorId/schedule"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <AdminDoctorScheduleView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/monitoring"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgMonitoringHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/appointments"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminAppointments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/patients"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminPatients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/laboratories"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminLaboratories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/pharmacy"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminPharmacies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/medical-records"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminMedicalRecords />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org-admin/analytics"
              element={
                <ProtectedRoute allowedRoles={["hospital_admin", "admin"]}>
                  <OrgAdminAnalytics />
                </ProtectedRoute>
              }
            />
            {/* Branch Admin Portal */}
            <Route
              path="/branch-admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["branch_admin", "admin"]}>
                  <BranchAdminDashboard />
                </ProtectedRoute>
              }
            />
            {/* Government Public Health Analytics */}
            <Route
              path="/government/dashboard"
              element={
                <ProtectedRoute allowedRoles={["government_authority", "admin"]}>
                  <GovernmentDashboard />
                </ProtectedRoute>
              }
            />
            {/* Unified Notification Center */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationCenter />
                </ProtectedRoute>
              }
            />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
