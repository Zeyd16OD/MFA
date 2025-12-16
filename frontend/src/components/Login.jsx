import React, { useState } from 'react';
import { login, verifyOTP, resendOTP, cancelOTP } from '../api';

const Login = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: email/password, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      console.log('Login response:', response.data);
      setStep(2); // Move to OTP verification
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowResendButton(false);

    try {
      const response = await verifyOTP(email, otpCode);
      const token = response.data.access_token;
      
      // Store token
      localStorage.setItem('token', token);
      
      // Notify parent component
      onLoginSuccess(token);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'OTP verification failed';
      setError(errorMessage);
      
      // Show resend button if OTP is invalid (not if blocked)
      if (!errorMessage.includes('Trop de tentatives')) {
        setShowResendButton(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setLoading(true);
    setShowResendButton(false);
    setOtpCode('');

    try {
      const response = await resendOTP(email, password);
      setError('');
      alert(response.data.message || 'Nouveau code OTP envoyé!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    setLoading(true);
    try {
      // Cancel the OTP session
      await cancelOTP(email);
    } catch (err) {
      console.error('Error cancelling OTP:', err);
    } finally {
      // Reset form state
      setStep(1);
      setOtpCode('');
      setError('');
      setShowResendButton(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--md-sys-color-background)' }}>
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--md-sys-color-primary)' }}>🔒 Secure HR System</h1>
          <p className="mt-2" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Multi-Factor Authentication</p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl mb-4" style={{ 
            backgroundColor: 'var(--md-sys-color-error-container)', 
            color: 'var(--md-sys-color-on-error-container)',
            border: '1px solid var(--md-sys-color-error)'
          }}>
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="zeydody@gmail.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="mt-4 text-center text-sm" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <p className="font-semibold mb-2">Demo Accounts:</p>
              <p>Employee: abdoumerabet374@gmail.com / emp123</p>
              <p>HR: zakarialaidi6@gmail.com / hr123</p>
              <p>Admin: zeydody@gmail.com / admin123</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="mb-6">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                Enter OTP Code
              </label>
              <p className="text-sm mb-3" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                Check your email ({email}) for the verification code
              </p>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="input-field text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength="6"
                pattern="[0-9]{6}"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            {showResendButton && (
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="btn-secondary w-full mt-3 disabled:opacity-50"
                style={{ 
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)'
                }}
              >
                {loading ? 'Envoi...' : 'Re-envoyer l\'OTP'}
              </button>
            )}

            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={loading}
              className="btn-secondary w-full mt-3 disabled:opacity-50"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
