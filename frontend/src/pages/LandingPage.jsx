import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Container from "../components/ui/Container";
import Section from "../components/ui/Section";
import { SectionHeader } from "../components/ui/Enterprise";

const architectureLayers = [
  { num: "01", name: "Patient Layer", desc: "Unified health records.", items: ["Appointments", "Records", "Prescriptions"] },
  { num: "02", name: "Clinical Layer", desc: "Digital clinical workflows.", items: ["Care Plans", "Doctor Notes", "Orders"] },
  { num: "03", name: "Hospital Layer", desc: "Operational management.", items: ["Departments", "Branches", "Teams"] },
  { num: "04", name: "Laboratory Layer", desc: "Diagnostic intelligence.", items: ["Diagnostics", "Validation", "Reports"] },
  { num: "05", name: "Pharmacy Layer", desc: "Secure fulfilment.", items: ["Fulfillment", "Audit", "QR Verification"] },
  { num: "06", name: "Governance Layer", desc: "Population analytics.", items: ["Population Health", "Analytics", "Policy"] }
];

const workflow = [
  { step: "Connect", desc: "Integrate networks." },
  { step: "Structure", desc: "Format medical data." },
  { step: "Coordinate", desc: "Align care teams." },
  { step: "Verify", desc: "Audit every action." }
];

const aiPipeline = [
  "Document",
  "OCR",
  "Classification",
  "Extraction",
  "Validation",
  "Structured Record"
];

function PlatformPreview({ stats }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col w-full max-w-[500px] lg:max-w-none">
      {/* App Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex gap-1.5 items-center">
           <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
           <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">Live Platform Metrics</p>
      </div>
      {/* App Body */}
      <div className="flex flex-1 min-h-[300px]">
         {/* Sidebar */}
         <div className="w-14 bg-slate-50 border-r border-slate-200 hidden sm:flex flex-col items-center py-4 gap-4 shrink-0">
            <div className="w-7 h-7 rounded bg-blue-100 mb-2"></div>
            <div className="w-5 h-5 rounded bg-slate-200"></div>
            <div className="w-5 h-5 rounded bg-slate-200"></div>
            <div className="w-5 h-5 rounded bg-slate-200"></div>
         </div>
         {/* Main Content */}
         <div className="flex-1 p-5 sm:p-6 bg-[#F8FAFC]">
            <div className="flex flex-wrap gap-2 items-center justify-between mb-5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">Operations Hub</h3>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold uppercase rounded tracking-wide">Network Secure</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start">
                 <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{stats.hospitals}</p>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-wider">Hospitals</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start">
                 <p className="text-2xl sm:text-3xl font-black text-emerald-700 leading-none">{stats.doctors}</p>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-wider">Clinicians</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start">
                 <p className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">{stats.patients}</p>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-wider">Patients</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start">
                 <p className="text-2xl sm:text-3xl font-black text-emerald-700 leading-none">{stats.prescriptions}</p>
                 <p className="text-[10px] font-bold uppercase text-slate-500 mt-2 tracking-wider">Prescriptions</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-black text-slate-900 mb-4">System Status</p>
              <div className="space-y-4">
                 <div>
                   <div className="flex justify-between items-center text-[10px] mb-1.5">
                      <span className="font-bold uppercase tracking-wide text-slate-500">OPD Queue Sync</span>
                      <span className="text-emerald-600 font-black">ACTIVE</span>
                   </div>
                   <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{width: '100%'}}></div></div>
                 </div>
                 
                 <div>
                   <div className="flex justify-between items-center text-[10px] mb-1.5">
                      <span className="font-bold uppercase tracking-wide text-slate-500">Lab Processing</span>
                      <span className="text-blue-600 font-black">PENDING</span>
                   </div>
                   <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: '65%'}}></div></div>
                 </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({
    hospitals: 14,
    doctors: 56,
    patients: 245,
    prescriptions: 382,
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    document.title = "VRITAN | Enterprise Healthcare Infrastructure";

    async function fetchPlatformSummary() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/public/platform-summary`);
        if (!res.ok) throw new Error("Summary unavailable");
        const data = await res.json();
        setStats({
          hospitals: data.hospitals ?? 14,
          doctors: data.doctors ?? 56,
          patients: data.patients ?? 245,
          prescriptions: data.prescriptions ?? 382,
        });
      } catch {
        // Keep stable product-preview values when the API is offline.
      }
    }

    fetchPlatformSummary();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    ["Why VRITAN", "#why-vritan"],
    ["Architecture", "#architecture"],
    ["Technology", "#ai"],
    ["Security", "#security"],
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 overflow-x-hidden font-sans">
      <header className={`sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow ${scrolled ? "border-slate-200 shadow-sm" : "border-slate-100"}`}>
        <Container>
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 rounded-lg focus-ring">
              <img src="/logo.png" alt="VRITAN" className="h-8 w-8 object-contain" />
              <div className="leading-none">
                <span className="block text-sm font-black tracking-tight text-slate-900">VRITAN</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-700">Healthcare</span>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 lg:flex">
              {navItems.map(([label, href]) => (
                <a key={href} href={href} className="text-xs font-bold text-slate-600 transition-colors hover:text-blue-700">
                  {label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-4 md:flex">
              <Link to="/sign-in" className="text-xs font-bold text-slate-600 hover:text-blue-700 transition-colors">Sign In</Link>
              <Button onClick={() => navigate("/join")}>Request Enterprise Access</Button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 md:hidden"
              aria-label="Toggle navigation"
            >
              Menu
            </button>
          </div>
        </Container>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-slate-200 bg-white p-4 shadow-lg md:hidden">
          <nav className="flex flex-col gap-3">
            {navItems.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="text-sm font-bold text-slate-700">
                {label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Button variant="secondary" onClick={() => navigate("/sign-in")}>Sign In</Button>
              <Button onClick={() => navigate("/join")}>Request Enterprise Access</Button>
            </div>
          </nav>
        </div>
      )}

      <Section id="hero" className="py-12 md:py-20 lg:py-24">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
            <div className="max-w-2xl animate-fade-up">
              <Badge variant="blue">AI-Powered Intelligent Healthcare Collaboration Platform</Badge>
              <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-slate-950 md:text-5xl lg:text-6xl">
                The intelligent operating layer for connected healthcare.
              </h1>
              <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-600">
                VRITAN connects clinical care, patient records, diagnostics, pharmacy fulfilment, and health governance through one trusted enterprise ecosystem.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={() => navigate("/join")}>Request Enterprise Access</Button>
                <Button variant="secondary" onClick={() => {
                  document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth" });
                }}>Explore the Platform</Button>
              </div>
            </div>

            <div className="animate-fade-in min-w-0 w-full flex justify-center lg:justify-end">
              <PlatformPreview stats={stats} />
            </div>
          </div>
        </Container>
      </Section>

      <Section id="why-vritan" bg="surface" className="py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="pt-2">
              <SectionHeader
                eyebrow="Why VRITAN"
                title="A unified ecosystem for modern care."
                description="Eliminate fragmented systems. We provide a single, secure environment where every stakeholder—from clinicians to labs—works in sync."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { 
                  icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>, 
                  title: "Trusted Networks", 
                  desc: "Hospitals, labs & clinics united." 
                },
                { 
                  icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>, 
                  title: "Clinical Operations", 
                  desc: "Records and compliance built-in." 
                },
                { 
                  icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>, 
                  title: "Data Integrity", 
                  desc: "Single source of truth." 
                },
                { 
                  icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>, 
                  title: "Governance", 
                  desc: "Auditable and secure workflows." 
                }
              ].map((item) => (
                <Card key={item.title} hoverEffect className="p-5 bg-white border-slate-200 flex flex-col items-start">
                  {item.icon}
                  <p className="mt-3 text-sm font-black text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section id="architecture" className="py-16">
        <Container>
          <SectionHeader eyebrow="Platform Architecture" title="Interconnected healthcare layers." align="center" />
          <div className="mt-10 flex flex-col md:flex-row gap-6 justify-center relative">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
              {architectureLayers.map((layer) => (
                <Card key={layer.name} hoverEffect className="p-5 border-slate-200 flex flex-col items-start relative overflow-hidden bg-white shadow-sm">
                  <div className="flex items-center gap-2 w-full">
                     <span className="text-xs font-black text-blue-700">{layer.num}</span>
                     <h3 className="text-base font-black text-slate-900">{layer.name}</h3>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">{layer.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {layer.items.map(item => (
                      <span key={item} className="inline-flex rounded border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-center shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-blue-800">AI Intelligence Layer</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-center shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800">Trust & Identity Layer</span>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="workflow" bg="surface" className="py-16">
        <Container>
          <SectionHeader eyebrow="Operating Workflow" title="A concrete path from data to care." align="center" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item, index) => (
              <Card key={item.step} hoverEffect className="p-5 flex flex-col relative overflow-hidden bg-white shadow-sm border-slate-200">
                <div className="absolute right-0 top-0 h-16 w-16 -translate-y-1/2 translate-x-1/3 rounded-full bg-slate-50"></div>
                <p className="text-xs font-black text-emerald-700">0{index + 1}</p>
                <p className="mt-2 text-base font-black text-slate-900">{item.step}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 relative z-10">{item.desc}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="ai" className="py-16">
        <Container>
          <SectionHeader
            eyebrow="AI Document Pipeline"
            title="Structuring medical data automatically."
            description="Our intelligence pipeline converts raw medical documents into verified, structured clinical records."
            align="center"
          />
          <div className="mt-10 overflow-x-auto pb-4 hide-scrollbar">
            <div className="flex items-center justify-between min-w-[700px] relative px-4 mx-auto max-w-4xl">
              {/* Connecting line */}
              <div className="absolute left-10 right-10 top-[20px] h-px bg-blue-200 z-0"></div>
              
              {aiPipeline.map((step, index) => (
                <div key={step} className="flex flex-col items-center relative z-10 bg-[#F8FAFC] px-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 shadow-sm">
                    {index + 1}
                  </div>
                  <span className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section id="qr-verification" bg="surface" className="py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="flex justify-center lg:justify-start lg:pl-10">
              <div className="relative z-10 w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
                {/* Mockup Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Prescription Rx</span>
                   <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                {/* Mockup Body */}
                <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-[#F8FAFC]">
                   <div className="w-28 h-28 bg-white border border-slate-200 p-2 flex flex-wrap gap-[2px] justify-between content-between shadow-sm">
                       {/* Fake QR pattern */}
                       {Array.from({length: 36}).map((_, i) => {
                           const isDark = [0,1,2,5,6,7,8,11,13,14,18,20,21,24,28,29,30,34,35].includes(i);
                           return <div key={i} className={`w-[14%] h-[14%] ${isDark ? 'bg-slate-800' : 'bg-transparent'}`}></div>
                       })}
                   </div>
                   <div className="mt-5 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      Verified Authentic
                   </div>
                </div>
                {/* Mockup Footer */}
                <div className="p-4 bg-white flex flex-col gap-2.5">
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Issuer</span>
                      <span className="text-[11px] font-black text-slate-800">Dr. Sarah Jenkins</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date</span>
                      <span className="text-[11px] font-black text-slate-800">Oct 24, 2026</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col justify-center">
              <SectionHeader
                eyebrow="Prescription Security"
                title="Cryptographic QR Verification."
                description="Generate secure, tamper-proof QR codes for every prescription. Pharmacies and patients can instantly verify authenticity, dosage, and issuer identity."
              />
              <div className="mt-6 flex flex-wrap gap-3">
                <Badge variant="blue">Tamper-proof</Badge>
                <Badge variant="emerald">Instant Audit</Badge>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="security" className="py-16">
        <Container>
          <SectionHeader
            eyebrow="Enterprise Security"
            title="Zero-trust healthcare compliance."
            description="Role-based access, verified stakeholders, and traceable actions."
            align="center"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[
              { step: "Identity", desc: "Verified clinical access." },
              { step: "Consent", desc: "Patient-controlled sharing." },
              { step: "Verification", desc: "Cryptographic validation." },
              { step: "Audit", desc: "Immutable action logs." }
            ].map((item) => (
              <Card key={item.step} hoverEffect className="p-5 bg-white border-slate-200">
                <h3 className="text-sm font-black text-slate-900">{item.step}</h3>
                <p className="mt-1.5 text-xs font-medium text-slate-600">{item.desc}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section bg="surface" className="py-20 border-t border-slate-200">
        <Container>
          <Card className="p-8 md:p-12 text-center max-w-4xl mx-auto border-slate-200 bg-white shadow-xl">
            <div className="flex flex-col items-center justify-center">
              <Badge variant="emerald">Enterprise Access</Badge>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                Modernize with VRITAN
              </h2>
              <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-slate-600">
                Deploy one secure healthcare operating platform across hospitals, laboratories, and pharmacies.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <Button size="lg" onClick={() => navigate("/join")}>
                  Request Enterprise Access
                </Button>
                <Link
                  to="/sign-in"
                  className="text-xs font-bold text-slate-600 hover:text-blue-700 transition-colors flex items-center gap-1 focus-ring rounded-lg px-2 py-1"
                >
                  Already registered? Sign In &rarr;
                </Link>
              </div>
            </div>
          </Card>
        </Container>
      </Section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <Container>
          <div className="flex flex-col gap-4 text-xs font-medium text-slate-500 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="VRITAN" className="h-6 w-6 object-contain" />
              <span className="font-black text-slate-900 tracking-tight">VRITAN</span>
            </div>
            <p>Enterprise healthcare infrastructure for trusted digital care.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}

export default LandingPage;
