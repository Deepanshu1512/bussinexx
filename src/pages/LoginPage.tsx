import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Lock, Mail, User, Building, ArrowRight, 
  ShieldCheck, CheckCircle2, PlayCircle, KeyRound, 
  RefreshCw, AlertCircle, Phone
} from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any, business: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // OTP Verification State
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  // Forgot / Reset Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleContinueAsGuest = () => {
    const guestUser = {
      id: 1,
      name: 'Guest Explorer',
      email: 'admin@bussinex.com',
      role: 'admin',
      business_id: 1,
    };
    const guestBusiness = {
      id: 1,
      name: 'Apex Enterprises Pvt Ltd',
      currency_symbol: '₹',
      currency_code: 'INR',
      tax_rate: 18.0,
      contact_email: 'contact@apex-enterprises.in',
      address: 'Brigade Tech Park, Whitefield, Bengaluru, Karnataka 560066',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      country: 'India'
    };
    onLoginSuccess(guestUser, guestBusiness);
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (!termsAccepted) throw new Error('You must agree to the Terms and Conditions to register.');
        
        const res = await api.auth.register(
          name, 
          email, 
          password, 
          businessName, 
          phone, 
          termsAccepted, 
          '2026.1'
        );

        if (!res.email_verified) {
          // Switch to OTP verification step
          setPendingVerificationEmail(email.trim().toLowerCase());
          setInfoMessage('Registration successful! A 6-digit verification code has been generated. Please verify to activate your store.');
          return;
        }

        onLoginSuccess(res.user, res.business);
        navigate('/');
      } else {
        const res = await api.auth.login(email, password);
        if (!res.email_verified) {
          setPendingVerificationEmail(email.trim().toLowerCase());
          setInfoMessage('Your email address is not yet verified. Please enter your 6-digit verification code.');
          return;
        }

        onLoginSuccess(res.user, res.business);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingVerificationEmail || !otpCode.trim()) return;
    setVerifyingOtp(true);
    setError(null);

    try {
      await api.auth.verifyEmail(pendingVerificationEmail, otpCode.trim());
      setInfoMessage('Email verified successfully! Logging you into your new store...');
      
      // Auto login or fetch user
      const me = await api.auth.getMe();
      onLoginSuccess(me.user, me.business);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingVerificationEmail) return;
    setResendingOtp(true);
    setError(null);
    try {
      await api.auth.resendVerification(pendingVerificationEmail);
      setInfoMessage('A new verification code has been dispatched.');
    } catch (err: any) {
      setError(err.message || 'Unable to resend verification code.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleQuickDemo = () => {
    setEmail('admin@bussinex.com');
    setPassword('admin123');
    setIsRegister(false);
    setError(null);
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      await api.auth.forgotPassword(forgotEmail);
      setForgotStep('reset');
      setForgotSuccess('If an account exists for this email, a reset code has been generated. Enter it below.');
    } catch (err: any) {
      setForgotError(err.message || 'Unable to request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);
    try {
      await api.auth.resetPassword(resetToken, newPassword);
      setForgotSuccess('Password updated successfully! You can now sign in with your new password.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('request');
        setForgotSuccess(null);
        setIsRegister(false);
      }, 2000);
    } catch (err: any) {
      setForgotError(err.message || 'Invalid or expired reset token.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/25">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">BUSSINEX</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono tracking-wider uppercase">
            Multi-Store Enterprise Commerce Platform
          </p>
        </div>

        {/* Card Surface */}
        <div className="p-6 sm:p-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl shadow-2xl space-y-5">
          {/* Quick Demo Access Button */}
          {!pendingVerificationEmail && (
            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="w-full py-3.5 px-4 rounded-2xl text-xs font-bold bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-sky-500/20 hover:from-emerald-500/30 hover:to-sky-500/30 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 flex items-center justify-between cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <PlayCircle className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <div className="text-left">
                  <span className="block font-bold text-white text-xs">Explore Demo Enterprise</span>
                  <span className="block text-[10px] text-emerald-400/80 font-normal">Preloaded multi-store catalog & live analytics</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {!pendingVerificationEmail && (
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-zinc-800 w-full" />
              <span className="bg-zinc-900 px-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 absolute">
                or registered store account
              </span>
            </div>
          )}

          {/* OTP Verification View */}
          {pendingVerificationEmail ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-2 border border-indigo-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Verify Your Email Address</h2>
                <p className="text-xs text-zinc-400">
                  Enter the 6-digit verification code sent to <strong className="text-zinc-200">{pendingVerificationEmail}</strong>.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
                  {error}
                </div>
              )}
              {infoMessage && (
                <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs">
                  {infoMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-widest text-lg font-mono py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length < 6}
                  className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{verifyingOtp ? 'Verifying Code...' : 'Activate Store'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resendingOtp ? 'animate-spin' : ''}`} />
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingVerificationEmail(null); setError(null); }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Toggle Pills */}
              <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(null); setInfoMessage(null); }}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                    !isRegister ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(null); setInfoMessage(null); }}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                    isRegister ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Register Store
                </button>
              </div>

              {/* Status / Error Banners */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs font-medium leading-relaxed">
                  {error}
                </div>
              )}
              {infoMessage && (
                <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs font-medium leading-relaxed">
                  {infoMessage}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Rajesh Kumar"
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Business / Enterprise Name</label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Apex Retail Enterprises"
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Mobile Number (+91)</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="business@example.in"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-zinc-300">Password</label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => { setShowForgotModal(true); setForgotEmail(email); }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {isRegister && (
                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="terms" className="text-xs text-zinc-400 leading-snug">
                      I agree to the{' '}
                      <Link to="/terms" target="_blank" className="text-indigo-400 underline hover:text-indigo-300">
                        Terms and Conditions
                      </Link>{' '}
                      and Privacy Policy.
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                >
                  <span>{loading ? 'Processing...' : isRegister ? 'Register & Verify Email' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Demo Credentials Button */}
              {!isRegister && (
                <div className="pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleQuickDemo}
                    className="w-full py-2 px-3 rounded-xl text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-indigo-400 border border-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Quick-Fill Demo Credentials (admin@bussinex.com)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Enterprise Bank-Grade Encryption • Strict Multi-Store Tenant Isolation</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Reset Account Password</h3>
              <button
                onClick={() => { setShowForgotModal(false); setForgotStep('request'); }}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ✕
              </button>
            </div>

            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
                {forgotError}
              </div>
            )}
            {forgotSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 text-xs">
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <p className="text-xs text-zinc-400">
                  Enter your registered email address and we'll send a 6-digit verification code to reset your password.
                </p>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="business@example.in"
                    className="w-full py-2 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">6-Digit Reset Code</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter code"
                    className="w-full py-2 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full py-2 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
