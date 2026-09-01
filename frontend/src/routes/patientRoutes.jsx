import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import PatientLayout from '../components/PatientLayout';
import { PatientProviders } from '../context/PatientProviders';

// Lazy loading Patient Portal pages
const PatientDashboardOverview = lazy(() => import('../pages/PatientDashboardOverview'));
const PatientMedicalRecords = lazy(() => import('../pages/PatientMedicalRecords'));
const PatientAppointments = lazy(() => import('../pages/PatientAppointments'));
const PatientPrescriptions = lazy(() => import('../pages/PatientPrescriptions'));
const PatientProfile = lazy(() => import('../pages/PatientProfile'));
const PatientSettings = lazy(() => import('../pages/PatientSettings'));
const PatientNotifications = lazy(() => import('../pages/PatientNotifications'));

export const getPatientRoutes = () => {
  return (
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute allowedRoles={["patient"]}>
          <PatientProviders>
            <PatientLayout />
          </PatientProviders>
        </ProtectedRoute>
      }
    >
      <Route index element={<PatientDashboardOverview />} />
      <Route path="records" element={<PatientMedicalRecords />} />
      <Route path="prescriptions" element={<PatientPrescriptions />} />
      <Route path="appointments" element={<PatientAppointments />} />
      <Route path="appointments/:doctorId" element={<PatientAppointments />} />
      <Route path="profile" element={<PatientProfile />} />
      <Route path="settings" element={<PatientSettings />} />
      <Route path="notifications" element={<PatientNotifications />} />
    </Route>
  );
};
