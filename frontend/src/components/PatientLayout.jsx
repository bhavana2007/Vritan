import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import PatientSidebar from './PatientSidebar';
import LoadingSkeleton from './LoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import VoiceAssistant from './VoiceAgent/VoiceAssistant';
import { Mic } from 'lucide-react';

function Breadcrumbs({ location }) {
  const pathnames = location.pathname.split('/').filter(x => x);
  
  if (pathnames.length <= 1) return null; // Don't show if just on /dashboard

  return (
    <nav className="flex text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        <li className="inline-flex items-center">
          <Link to="/dashboard" className="inline-flex items-center hover:text-blue-700 transition-colors">
            Dashboard
          </Link>
        </li>
        {pathnames.slice(1).map((value, index) => {
          const isLast = index === pathnames.length - 2;
          const to = `/${pathnames.slice(0, index + 2).join('/')}`;
          const title = value.charAt(0).toUpperCase() + value.slice(1);

          return (
            <li key={to} aria-current={isLast ? 'page' : undefined}>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-slate-400 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {isLast ? (
                  <span className="ml-1 font-medium text-slate-900 md:ml-2">{title}</span>
                ) : (
                  <Link to={to} className="ml-1 hover:text-blue-700 md:ml-2 transition-colors">
                    {title}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const PatientLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('vritan_sidebar_collapsed');
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem('vritan_sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  // Close mobile sidebar and handle scroll restoration when route changes
  useEffect(() => {
    setIsMobileOpen(false);
    
    // Scroll restoration
    const mainElement = document.getElementById('patient-main-content');
    if (mainElement) {
        mainElement.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Document Title update
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    let title = 'Dashboard';
    if (segments.length > 1) {
        title = segments[segments.length - 1];
        title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    document.title = `${title} • Vritan`;
  }, [location.pathname]);

  // Keyboard navigation for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'b') {
        setIsCollapsed(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out flex-shrink-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        <div className="h-full sticky top-0 overflow-y-auto overflow-x-hidden bg-white border-r border-slate-200 shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
            {/* We no longer need to pass currentPage, sidebar uses useLocation */}
            <PatientSidebar 
              isCollapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header for hamburger */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center shadow-sm z-30">
            <button 
                onClick={() => setIsMobileOpen(true)}
                className="p-2 -ml-2 mr-3 text-slate-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                aria-label="Open sidebar"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Vritan" className="h-8 w-8 object-contain" />
                <span className="font-bold text-slate-900">VRITAN</span>
            </div>
        </div>
        
        <div id="patient-main-content" className="flex-1 overflow-y-auto p-4 sm:p-8">
            <Breadcrumbs location={location} />
            <ErrorBoundary>
                <React.Suspense fallback={<LoadingSkeleton type="profile" />}>
                    <Outlet />
                </React.Suspense>
            </ErrorBoundary>
        </div>
      </main>

      {/* Floating Microphone Button */}
      <button
        onClick={() => setIsVoiceAgentOpen(true)}
        className="fixed bottom-8 right-8 z-40 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
        aria-label="Open VRITAN Voice Assistant"
      >
        <Mic className="w-8 h-8" />
      </button>

      {/* Slide-over Voice Assistant Panel */}
      {isVoiceAgentOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setIsVoiceAgentOpen(false)}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[400px] lg:w-[450px] shadow-2xl transform transition-transform duration-300 ease-in-out translate-x-0">
            <VoiceAssistant 
              standalone={false} 
              onClose={() => setIsVoiceAgentOpen(false)} 
            />
          </div>
        </>
      )}

    </div>
  );
};

export default PatientLayout;
