import React from 'react';
import { PatientProfileProvider } from './PatientProfileContext';
import { NotificationProvider } from './NotificationContext';
import { MedicalRecordProvider } from './MedicalRecordContext';
import { PrescriptionProvider } from './PrescriptionContext';
import { AppointmentProvider } from './AppointmentContext';

export function PatientProviders({ children }) {
  return (
    <PatientProfileProvider>
      <NotificationProvider>
        <MedicalRecordProvider>
          <PrescriptionProvider>
            <AppointmentProvider>
              {children}
            </AppointmentProvider>
          </PrescriptionProvider>
        </MedicalRecordProvider>
      </NotificationProvider>
    </PatientProfileProvider>
  );
}
