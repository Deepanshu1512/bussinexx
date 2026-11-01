import React from 'react';
import { ArrowLeft, Shield, FileText, AlertCircle, Building2, Lock, Scale, CheckCircle2 } from 'lucide-react';

export const TermsPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">Bussinex</span>
              <span className="text-xs text-zinc-400 block -mt-1">Business Management Platform</span>
            </div>
          </div>

          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-sm font-medium text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <a
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-sm font-medium text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to App
            </a>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Title & Disclaimer Banner */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileText className="w-3.5 h-3.5" />
            Version 2026.1 • Effective Date: January 1, 2026
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Terms & Conditions of Service
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Please read these Terms and Conditions carefully before registering or using the Bussinex business management platform.
          </p>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300 font-semibold block mb-0.5">Notice for Legal Review:</strong>
              This document represents standard enterprise platform operational terms designed for Bussinex multi-store operations. 
              These terms are marked for review by qualified legal counsel prior to commercial public rollout in your jurisdiction.
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8 divide-y divide-zinc-800/80 text-sm text-zinc-300">
          {/* Section 1 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">1</span>
              Account Registration & Responsibilities
            </div>
            <p className="leading-relaxed text-zinc-400">
              To access and use Bussinex, you must register a business account providing accurate, complete, and current information, 
              including a valid real email address and contact details. You agree to verify your email address through our one-time verification 
              code (OTP) protocol. You are solely responsible for safeguarding the credentials associated with your account and for all activities 
              conducted under your account.
            </p>
          </section>

          {/* Section 2 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">2</span>
              Business Account Ownership & Multi-Store Management
            </div>
            <p className="leading-relaxed text-zinc-400">
              The individual or legal entity registering the primary business account is the designated Business Owner. 
              The Business Owner may establish multiple stores, locations, and user accounts. The Business Owner is accountable 
              for assigning appropriate role-based permissions (Administrators, Managers, Staff) and maintaining supervisory authority 
              over all store-level operations and inter-store inventory transfers.
            </p>
          </section>

          {/* Section 3 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">3</span>
              Acceptable Use Policy
            </div>
            <p className="leading-relaxed text-zinc-400">
              You agree to use Bussinex exclusively for lawful commercial business operations. You must not:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-zinc-400">
              <li>Use the platform to distribute counterfeit, illicit, or unauthorized merchandise.</li>
              <li>Attempt to reverse-engineer, decompile, or tamper with system security or APIs.</li>
              <li>Probe, scan, or exploit security vulnerabilities or bypass authentication mechanisms.</li>
              <li>Transmit harmful code, malware, automated scraping bots, or initiate denial-of-service attacks.</li>
              <li>Impersonate any entity or falsely represent affiliations with other businesses.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">4</span>
              Data Ownership, Privacy & Responsibilities
            </div>
            <p className="leading-relaxed text-zinc-400">
              You retain all ownership rights, title, and interest in your business data, including inventory catalogs, pricing, 
              sales transactions, customer records, and financial metrics. Bussinex implements strict multi-tenant tenant isolation to 
              guarantee that your proprietary business records are never exposed to other businesses. You are responsible for ensuring that 
              any customer personal data you store conforms to applicable privacy regulations (including India's Digital Personal Data Protection Act).
            </p>
          </section>

          {/* Section 5 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">5</span>
              Payment & Subscription Terms
            </div>
            <p className="leading-relaxed text-zinc-400">
              Access to specific tiers, enterprise multi-store configurations, or AI capabilities may be subject to recurring subscription fees. 
              All fees are billed in Indian National Rupees (INR ₹) or local equivalent and are non-refundable unless required by applicable law. 
              Taxes (including applicable Goods & Services Tax - GST) will be charged in accordance with governing state and central regulations.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">6</span>
              Account Suspension & Termination
            </div>
            <p className="leading-relaxed text-zinc-400">
              Bussinex reserves the right to suspend or terminate accounts that breach these Terms, engage in fraudulent transactions, 
              or compromise platform security. You may terminate your account at any time via Settings. Upon verified termination, your store 
              data will be purged or archived in accordance with our data retention schedule and statutory requirements.
            </p>
          </section>

          {/* Section 7 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">7</span>
              Limitation of Liability
            </div>
            <p className="leading-relaxed text-zinc-400">
              To the maximum extent permitted by applicable law, Bussinex and its affiliates shall not be liable for any indirect, incidental, 
              punitive, or consequential damages, including loss of business profits, goodwill, revenue, or business interruption arising out of 
              the use or inability to use the platform services.
            </p>
          </section>

          {/* Section 8 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">8</span>
              Modifications to Terms
            </div>
            <p className="leading-relaxed text-zinc-400">
              We may update these Terms periodically to reflect enhancements in services, legal requirements, or regulatory standards. 
              When updates occur, the effective version number and date will be updated. Continued use of Bussinex following notified changes 
              constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 9 */}
          <section className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs text-indigo-400 border border-zinc-700">9</span>
              Contact Information
            </div>
            <p className="leading-relaxed text-zinc-400">
              For questions, privacy inquiries, or terms compliance notices, contact our platform operations office at:
            </p>
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1 text-zinc-300">
              <p className="font-semibold text-white">Bussinex Enterprise Operations</p>
              <p>Email: legal@bussinex.com | support@bussinex.com</p>
              <p>Regional Office: Bengaluru, Karnataka, India</p>
            </div>
          </section>
        </div>

        {/* Footer info */}
        <div className="pt-8 border-t border-zinc-800 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Bussinex Technologies. All rights reserved. System Status: Operational.
        </div>
      </main>
    </div>
  );
};

export default TermsPage;
