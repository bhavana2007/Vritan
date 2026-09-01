import React from "react";

// Standard icon props wrapper to ensure consistency
const withIcon = (SvgPath) => {
  return ({ className = "h-6 w-6", size = 24, strokeWidth = 2, ...props }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <SvgPath />
    </svg>
  );
};

export const HospitalIcon = withIcon(() => (
  <>
    <path d="M3 21h18" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
    <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
    <path d="M10 9h4" />
    <path d="M12 7v4" />
  </>
));

export const DoctorIcon = withIcon(() => (
  <>
    <path d="M4.8 2.3A.3.3 0 1 0 5 2h-.2Z" />
    <path d="M19 10H5a2 2 0 0 0-2 2v9h18v-9a2 2 0 0 0-2-2Z" />
    <path d="M12 10V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v7" />
    <path d="M14 21v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <circle cx="12" cy="7" r="1" fill="currentColor" />
  </>
));

export const LabIcon = withIcon(() => (
  <>
    <path d="M4.5 3h15" />
    <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
    <path d="M6 14h12" />
  </>
));

export const PrescriptionIcon = withIcon(() => (
  <>
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <path d="M8 6h8" />
    <path d="M8 10h8" />
    <path d="M8 14h6" />
    <path d="m9 16 2 2 4-4" />
  </>
));

export const AnalyticsIcon = withIcon(() => (
  <>
    <line x1="18" x2="18" y1="20" y2="10" />
    <line x1="12" x2="12" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="14" />
  </>
));

export const AppointmentIcon = withIcon(() => (
  <>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </>
));

export const ShieldIcon = withIcon(() => (
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </>
));

export const UserIcon = withIcon(() => (
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
));

export const NotificationIcon = withIcon(() => (
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
));

export const LockIcon = withIcon(() => (
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
));

export const SearchIcon = withIcon(() => (
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
));

export const ArrowRightIcon = withIcon(() => (
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>
));

export const CheckIcon = withIcon(() => (
  <>
    <path d="M20 6 9 17l-5-5" />
  </>
));

export const AIIcon = withIcon(() => (
  <>
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </>
));

export const WorkflowIcon = withIcon(() => (
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M10 6h4M10 18h4M7 10v4M17 10v4" />
  </>
));

export const CloseIcon = withIcon(() => (
  <>
    <path d="M18 6 6 18M6 6l12 12" />
  </>
));

export const MenuIcon = withIcon(() => (
  <>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>
));

export const SunIcon = withIcon(() => (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>
));

export const MoonIcon = withIcon(() => (
  <>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </>
));

export const MonitorIcon = withIcon(() => (
  <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </>
));

export const ActivityIcon = withIcon(() => (
  <>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </>
));
