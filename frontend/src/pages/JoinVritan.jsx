import { useNavigate, Link } from "react-router-dom";

function JoinVritan() {
  const navigate = useNavigate();

  const activeStakeholders = [
    {
      id: "patient",
      title: "Patient",
      icon: "👤",
      badge: "OTP Authenticated",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      description: "Access your digital health locker, prescription QR wallet, AI medical summaries, and book OPD appointments.",
      benefits: ["Lifetime Medical Vault", "Encrypted Prescription QR", "ABHA & Consent Sharing"],
      actionText: "Register as Patient",
      route: "/register/patient",
    },
    {
      id: "doctor",
      title: "Doctor / Clinician",
      icon: "🩺",
      badge: "Verified EHR Workspace",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Focused examination workspace, AI diagnostic summaries, medicine regimen builder, and automated QR generation.",
      benefits: ["Scenario 1/2/3 Onboarding", "Automated Prescription PDF", "OPD Waiting Queue"],
      actionText: "Register as Doctor",
      route: "/register/doctor",
    },
    {
      id: "hospital",
      title: "Hospital / Healthcare Organization",
      icon: "🏥",
      badge: "Enterprise Network",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      description: "Multi-department EHR infrastructure, staff RBAC management, bed utilization tracking, and permanent Vritan ID.",
      benefits: ["Permanent VR-HOSP ID", "Doctor Auto-Linking", "Department & Staff RBAC"],
      actionText: "Register Hospital Network",
      route: "/register/hospital",
    },
    {
      id: "pharmacy",
      title: "Pharmacy",
      icon: "💊",
      badge: "Dispensing Node",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Scan patient QR codes, verify prescription digital authenticity, log dispensing history, and manage inventory.",
      benefits: ["VR-PHAR Registry", "Instant QR Scanner", "Dispensation Audit Logs"],
      actionText: "Register Pharmacy",
      route: "/register/pharmacy",
    },
    {
      id: "government",
      title: "Government Health Authority",
      icon: "🏛️",
      badge: "Public Health Intelligence",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Anonymized regional public health analytics, outbreak monitoring, hospital utilization stats, and district reports.",
      benefits: ["100% Zero PII Access", "Epidemiological Heatmaps", "Regional Trend Reports"],
      actionText: "Register Health Authority",
      route: "/register/government",
    },
    {
      id: "laboratory",
      title: "Laboratory",
      icon: "🔬",
      badge: "Diagnostic Node",
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
      description: "Diagnostic lab orders, patient search, and digital report signing using Vritan verification keys.",
      benefits: ["VR-LAB Registry", "QR Patient Search", "Digital Document Signature"],
      actionText: "Register Laboratory",
      route: "/register/laboratory",
    },
  ];

  const comingSoonStakeholders = [
    { title: "Insurance Provider", icon: "🛡️", desc: "Cashless claim verification & policy linkage" },
    { title: "Diagnostic Center", icon: "🩻", desc: "Radiology, MRI, and imaging repository" },
    { title: "Ambulance Services", icon: "🚑", desc: "Emergency response dispatch & GPS tracking" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header Banner */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <span>🌐</span> Enterprise Onboarding
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Get Started with Vritan
          </h1>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            The unified registration gateway for Patients, Clinicians, and Healthcare Organizations.
          </p>
        </div>

        {/* Stakeholder Registration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeStakeholders.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl p-7 shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shadow-inner">
                    {s.icon}
                  </div>
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{s.description}</p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Key Benefits</span>
                  {s.benefits.map((b, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <span className="text-emerald-600">✓</span> {b}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => navigate(s.route)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  {s.actionText} &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Future Ready Stakeholders (Coming Soon) */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">Future Ready Ecosystem Nodes</h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full uppercase border">
              Coming Soon
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {comingSoonStakeholders.map((cs, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cs.icon}</span>
                  <h4 className="font-bold text-sm text-slate-800">{cs.title}</h4>
                </div>
                <p className="text-xs text-slate-500">{cs.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Already Registered Sign In Bar */}
        <div className="text-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="text-left">
            <h4 className="font-bold text-slate-900 text-sm">Already have an active Vritan account?</h4>
            <p className="text-xs text-slate-500">Sign in with your Email, Vritan ID, or OTP to access your portal.</p>
          </div>
          <Link
            to="/"
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            Sign In to Platform &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

export default JoinVritan;
